import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

const serverFiles = ['src/**/*.server.{js,mjs,ts}', 'src/lib/server/**/*.{js,mjs,ts}'];

export default defineConfig(
  {
    ignores: [
      'node_modules/**',
      'logos/**',
      'static/**',
      '_site/**',
      'local-artifacts/site-copy-review/**/site/**',
      '.svelte-kit/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,svelte}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,svelte}'],
    extends: [ts.configs.recommended],
  },
  svelte.configs.recommended,
  {
    files: ['src/**/*.{js,mjs,ts,svelte}'],
    ignores: serverFiles,
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      'scripts/**/*.{js,mjs,ts}',
      'tests/**/*.{js,mjs,ts}',
      '*.config.{js,mjs,ts}',
      'local-artifacts/**/server.mjs',
      'local-artifacts/**/capture.mjs',
      ...serverFiles,
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright callbacks execute inside the page as well as in Node.
    files: ['tests/browser/**/*.{js,mjs,ts}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  {
    // These components receive route/asset URLs from helpers that already include
    // the resolved base path, or validated external HTTPS URLs. The rule cannot
    // trace those helper calls or component props without type-aware linting.
    files: [
      'src/lib/components/AssetWorkspace.svelte',
      'src/lib/components/BrandCard.svelte',
      'src/lib/components/BrandDetail.svelte',
    ],
    rules: { 'svelte/no-navigation-without-resolve': ['error', { ignoreLinks: true }] },
  },
  prettier,
  svelte.configs.prettier,
);

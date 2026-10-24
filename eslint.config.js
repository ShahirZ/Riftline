// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const SIM_RULE_MESSAGE =
  'src/sim and src/data must stay deterministic and free of DOM/three.js. Presentation code belongs in src/client.';

/** Globals the deterministic simulation must never touch: DOM, wall-clock time, timers, I/O. */
const SIM_FORBIDDEN_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'performance',
  'Date',
  'setTimeout',
  'setInterval',
  'fetch',
  'AudioContext',
].map((name) => ({ name, message: SIM_RULE_MESSAGE }));

export default defineConfig(
  { ignores: ['dist', 'coverage', 'node_modules', 'smoke-artifacts'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The architecture boundary: simulation and data never depend on rendering, DOM or wall-clock.
    files: ['src/sim/**/*.ts', 'src/data/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['three', 'three/*'], message: SIM_RULE_MESSAGE },
            { group: ['**/client/**', '**/app/**'], message: SIM_RULE_MESSAGE },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...SIM_FORBIDDEN_GLOBALS],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded Rng (src/sim/core/rng.ts) so recoil and bots stay reproducible.',
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);

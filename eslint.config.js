import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Layer rules: which layer may import which. See CONTRIBUTING.md for the reasoning.
const layers = [
  { from: 'core', allow: ['core'] },
  { from: 'source', allow: ['core'] },
  { from: 'analytics', allow: ['core'] },
  { from: 'i18n', allow: ['i18n'] },
  { from: 'app', allow: ['core', 'app'] },
  { from: 'ui', allow: ['app', 'i18n', 'ui'] },
  { from: 'worker', allow: ['core', 'source', 'analytics', 'app'] },
];
const mainAllows = ['app', 'ui', 'i18n'];

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: globals.browser,
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { node: { extensions: ['.ts', '.js'] } },
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core' },
        { type: 'source', pattern: 'src/sources/*', capture: ['name'] },
        { type: 'analytics', pattern: 'src/analytics' },
        { type: 'app', pattern: 'src/app' },
        { type: 'worker', pattern: 'src/worker' },
        { type: 'ui', pattern: 'src/ui' },
        { type: 'i18n', pattern: 'src/i18n' },
      ],
      // The page composition root is a single file, so it is classified as a file.
      'boundaries/files': [{ category: 'main', pattern: 'src/main.ts' }],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: layers
            .map(({ from, allow }) => ({
              from: { element: { type: from } },
              allow: { to: { element: { types: { anyOf: allow } } } },
            }))
            .concat({
              from: { file: { categories: 'main' } },
              allow: { to: { element: { types: { anyOf: mainAllows } } } },
            }),
        },
      ],
    },
  },
  {
    // core is platform-free: no browser globals and no packages.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'self', 'navigator', 'fetch'],
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '^[^.]', message: 'core must not depend on packages.' }] },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  prettier,
);

import js from '@eslint/js';

const browser = Object.fromEntries(
  [
    'window', 'document', 'location', 'history', 'navigator', 'console',
    'fetch', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout',
    'clearTimeout', 'setInterval', 'clearInterval', 'ResizeObserver',
    'IntersectionObserver', 'matchMedia', 'URL', 'URLSearchParams', 'CSS',
    'HTMLElement', 'Event', 'CustomEvent',
  ].map((g) => [g, 'readonly']),
);

export default [
  { ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browser },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.{js,mjs}', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...browser, process: 'readonly', console: 'readonly' },
    },
  },
];

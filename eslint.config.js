const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const typescriptResolver = require.resolve('eslint-import-resolver-typescript', {
  paths: [require.resolve('eslint-config-expo')],
});

module.exports = defineConfig([
  { ignores: ['dist/**', 'backend/worker-configuration.d.ts'] },
  expoConfig,
  {
    settings: {
      // Expo owns this dependency; resolve it from Expo instead of the root.
      'import/resolver': [{ [typescriptResolver]: {} }, 'node'],
    },
  },
  {
    files: ['backend/test/**'],
    rules: { 'import/no-unresolved': ['error', { ignore: ['^cloudflare:'] }] },
  },
]);

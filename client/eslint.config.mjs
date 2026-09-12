import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const expoConfig = require('eslint-config-expo/flat');

export default [
  ...expoConfig,
  { ignores: ['dist/**', 'dist-test/**', '.expo/**'] },
];

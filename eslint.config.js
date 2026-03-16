import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default [
  { files: ['src/**/*.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
];

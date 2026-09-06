// @ts-check
import { createEslintConfig } from './eslint.shared.mjs';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: [
    'packages/*/dist/**',
    'packages/*/scripts/**',
    'packages/*/bin/**',
    'tooling/**',
    '**/eslint.config.mjs',
    'eslint.shared.mjs',
    'vitest.config.ts',
    'prettier.config.mjs',
  ],
});

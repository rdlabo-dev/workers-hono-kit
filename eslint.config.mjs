// @ts-check
import { createEslintConfig } from './eslint.shared.mjs';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: [
    'dist/**',
    'packages/*/dist/**',
    'scripts/**',
    'packages/*/scripts/**',
    '**/eslint.config.mjs',
    'eslint.shared.mjs',
    'vitest.config.ts',
    'prettier.config.mjs',
  ],
});

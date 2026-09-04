// @ts-check
import { createEslintConfig } from './eslint.shared.mjs';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['eslint.config.mjs', 'eslint.shared.mjs', 'vitest.config.ts', 'prettier.config.mjs'],
});

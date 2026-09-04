import { createEslintConfig } from '../../eslint.shared.mjs';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['dist'],
});

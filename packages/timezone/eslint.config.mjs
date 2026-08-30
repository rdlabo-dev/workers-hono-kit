// @ts-check
import baseConfig from '@hono/eslint-config';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist'],
  },
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      'import-x/extensions': ['error', 'ignorePackages', { ts: 'never', js: 'always' }],
    },
  },
);

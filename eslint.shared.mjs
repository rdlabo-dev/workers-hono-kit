// @ts-check
// Canonical type-aware policy for every TypeScript workspace in this repository.
import baseConfig from '@hono/eslint-config';
import rdlabo from '@rdlabo/eslint-plugin-rules';
import tseslint from 'typescript-eslint';

/**
 * Build the repository ESLint policy with a workspace-specific TypeScript root and ignore list.
 *
 * @param {{ tsconfigRootDir: string; ignores: string[] }} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function createEslintConfig({ tsconfigRootDir, ignores }) {
  return tseslint.config(
    { ignores },
    ...baseConfig,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
    },
    {
      plugins: {
        '@rdlabo/rules': rdlabo,
      },
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/require-await': 'off',
        '@rdlabo/rules/restrict-try-block': [
          'error',
          {
            allowPromise: false,
            allowRxjs: false,
            allowInSignal: false,
            maxLines: 3,
          },
        ],
        // Relative source imports use explicit .js extensions because tsc preserves specifiers and
        // the emitted package must remain directly loadable by Node ESM.
        'import-x/extensions': ['error', 'ignorePackages', { ts: 'never', tsx: 'never', js: 'always' }],
      },
    },
  );
}

---
title: Try timezone conversions and ESLint together
---

One instant can belong to different calendar dates. First see that difference, then make ESLint report code that accidentally falls back to the host timezone.

## 1. Install the pair

Requires Node.js 24 and npm.

```sh
mkdir timezone-demo
cd timezone-demo
npm init -y
npm pkg set type=module
npm install @rdlabo/workers-timezone@0.12.2
npm install --save-dev @rdlabo/eslint-plugin-rules@22.1.0 eslint@10 @eslint/js@10 typescript@6 typescript-eslint@8 tsx@4
```

## 2. See the calendar date change

Save this as `demo.ts`. Initialize the application timezone once at module scope; pass a per-call timezone for a user-specific conversion.

```ts
import { initializeTimezone, toLocalDate, toLocalDateTime } from '@rdlabo/workers-timezone';

initializeTimezone({ timeZone: 'Asia/Tokyo' });
const instant = new Date('2026-01-01T15:00:00Z');
console.log(toLocalDateTime(instant));
console.log(toLocalDate(instant, 'America/New_York'));
```

```sh
npx tsx demo.ts
```

```text
2026-01-02 00:00:00
2026-01-01
```

The same instant is January 2 in Tokyo and January 1 in New York. Add an explicit timezone argument for another city to explore the difference.

## 3. Make an accidental regression visible

Save this as `tsconfig.json` so typed linting can find `demo.ts`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true
  },
  "include": ["demo.ts"]
}
```

Save this as `eslint.config.mjs`. Keep type-aware configuration scoped to TypeScript files:

```js
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import rdlabo from '@rdlabo/eslint-plugin-rules/typescript';

export default tseslint.config(
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url)),
      },
    },
    plugins: { '@rdlabo/rules': rdlabo },
  },
  ...rdlabo.configs['workers-timezone/recommended'],
);
```

Check the correct example:

```sh
npx eslint demo.ts
```

It should exit successfully without diagnostics. Now append this deliberately incorrect line to `demo.ts`:

```ts
console.log(instant.getDate());
```

```sh
npx eslint demo.ts
```

Expect a nonzero exit status and `@rdlabo/rules/no-implicit-timezone`. `getDate()` reads the host-local day, which bypasses the application timezone. Replace only the added line with:

```ts
console.log(toLocalDate(instant));
```

```sh
npx eslint demo.ts
npx tsx demo.ts
```

Lint should pass again; the added final line prints `2026-01-02`.

## 4. Use it in your app

Follow [application setup](https://docs.rdlabo.dev/projects/workers-timezone/docs/readme) to choose the default timezone, then [enable ESLint in CI](https://docs.rdlabo.dev/projects/workers-timezone/docs/eslint). See [Timezones and calendar dates](https://docs.rdlabo.dev/projects/workers-timezone/docs/timezones) for per-user settings, DST, and database boundaries.

---
title: Catch timezone bugs with ESLint
---

Keep new Cloudflare Workers code on the same timezone policy. Pair `@rdlabo/workers-timezone` with `@rdlabo/eslint-plugin-rules` to catch host-local `Date` / `Intl` operations and request-scoped initialization.

For a runnable demo of both packages, start with [Try conversions and lint](https://docs.rdlabo.dev/projects/workers-timezone/docs/quickstart).

## Enable the companion preset

This example uses Node.js 24. In an app using `@rdlabo/workers-timezone`, install the lint dependencies:

```sh
npm install --save-dev eslint@10 @eslint/js@10 typescript@6 typescript-eslint@8 @rdlabo/eslint-plugin-rules@22
```

Add the timezone preset and typed linting to `eslint.config.mjs`. The TypeScript files you lint must be included in the app's `tsconfig.json`.

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

Keep your existing configuration entries when merging this setup. The separate `workers/recommended` preset does not enable timezone checks.

## Catch a host-local date

This reads the host's calendar date instead of your application's:

```ts
const instant = new Date('2026-01-01T15:00:00Z');
console.log(instant.getDate());
```

Use the library to select the calendar timezone:

```ts
import { toLocalDate } from '@rdlabo/workers-timezone';

const instant = new Date('2026-01-01T15:00:00Z');
console.log(toLocalDate(instant, 'Asia/Tokyo'));
// 2026-01-02
```

`no-implicit-timezone` also reports supported `Intl` formatting calls without an explicit `timeZone`. UTC methods and `toISOString()` remain available for instant-based operations.

## Keep initialization out of requests

`initialize-timezone-at-module-scope` reports this:

```ts
import { initializeTimezone } from '@rdlabo/workers-timezone';

export function handleRequest() {
  initializeTimezone({ timeZone: 'Asia/Tokyo' });
}
```

Initialize during module evaluation instead:

```ts
import { initializeTimezone } from '@rdlabo/workers-timezone';

initializeTimezone({ timeZone: 'Asia/Tokyo' });
```

For a user's timezone, pass an explicit argument to the conversion. The initialization rule checks each file; it does not enforce a single initialization across the entire app.

## Run it in CI

After installing dependencies, run:

```sh
npx eslint 'src/**/*.ts' --max-warnings 0
```

Adjust the source path for your app. Keep timezone tests for DST and calendar boundaries: static checks cover recognizable operations, not every dynamic value.

See the [Date / Intl rule](https://docs.rdlabo.dev/projects/eslint-plugin-rules/docs/rules/no-implicit-timezone), [initialization rule](https://docs.rdlabo.dev/projects/eslint-plugin-rules/docs/rules/initialize-timezone-at-module-scope), and [timezone behavior](https://docs.rdlabo.dev/projects/workers-timezone/docs/timezones).

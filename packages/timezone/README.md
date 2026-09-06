# @rdlabo/workers-timezone

Timezone-aware calendar and wall-clock utilities for Cloudflare Workers. Workers execute with UTC
instants; this package lets an application select an IANA timezone once per isolate and handles DST
when converting between instants and local dates.

Fixed MySQL `+09:00` storage helpers live in [`@rdlabo/workers-mysql`](https://docs.rdlabo.dev/projects/workers-mysql/docs/readme)
and do not follow this package's IANA display timezone.

## Start with conversions and checks together

[Try timezone conversions and ESLint together](./docs/quickstart.md).

Pair this library with `workers-timezone/recommended` from `@rdlabo/eslint-plugin-rules` to detect implicit timezone dependencies. Enable typed linting and run lint in CI.

## Install

```sh
npm install @rdlabo/workers-timezone
```

## Quick start

```ts
import { TIME_ZONES, initializeTimezone, localDateTimeToInstant, toLocalDateTime } from '@rdlabo/workers-timezone';

initializeTimezone({ timeZone: TIME_ZONES.NEW_YORK });

toLocalDateTime(new Date('2026-07-01T13:00:00Z'));
// '2026-07-01 09:00:00'

localDateTimeToInstant('2026-07-01', '09:00:00');
// 2026-07-01T13:00:00.000Z
```

Initialize once during module evaluation, never per request or tenant. The uninitialized default
is `Asia/Tokyo`; pass an explicit timezone to conversions for user-specific behavior.

## Recommended ESLint companion

The preset checks host-local `Date` / `Intl` usage and the placement of `initializeTimezone`.

Limits:

- `no-implicit-timezone` needs typed linting (`recommendedTypeChecked` + `projectService`).
- `initialize-timezone-at-module-scope` is syntactic: a file may omit initialization; when present,
  there may be at most one allowed site in that file—not an app-wide single site, and not a
  mandatory call in every module.
- `toISOString()` and other explicit instant APIs remain available.

```sh
npm install --save-dev eslint @eslint/js typescript typescript-eslint @rdlabo/eslint-plugin-rules
```

Scope type-aware TypeScript configs to `**/*.ts` so tools that lint `eslint.config.mjs` do not ask
`projectService` for a project that excludes that file:

```js
// eslint.config.mjs
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import rdlabo from '@rdlabo/eslint-plugin-rules/typescript';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir },
    },
    plugins: { '@rdlabo/rules': rdlabo },
  },
  ...rdlabo.configs['workers-timezone/recommended'],
);
```

See the ESLint plugin [Configuration](https://docs.rdlabo.dev/projects/eslint-plugin-rules/docs/configuration)
guide for Workers presets and typed-linting details.

## Documentation

- [Timezones and calendar dates](https://docs.rdlabo.dev/projects/workers-timezone/docs/timezones) — configuration, DST, and database boundaries.
- [API](https://docs.rdlabo.dev/projects/workers-timezone/docs/api) — conversions, calendar operations, types, and compatibility names.
- [Migration](https://docs.rdlabo.dev/projects/workers-timezone/docs/migration) — moving from the kit and behavior changes.

These guides describe this source revision. Use the matching release tag for an installed version.

<!-- rdlabo-docs-omit -->

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT

<!-- /rdlabo-docs-omit -->

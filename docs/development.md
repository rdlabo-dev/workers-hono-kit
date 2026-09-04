# Development

These commands are used when working on the package itself:

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest
npm run build       # tsc -p tsconfig.build.json → dist/
```

## Candidate artifacts and publication

`@rdlabo/workers-timezone` and `@rdlabo/workers-mysql` are private workspaces and are not published
to npm yet. Pull requests and merges still build immutable candidate tarballs for all three
packages:

- `rdlabo-workers-hono-kit-*.tgz`
- `rdlabo-workers-timezone-*.tgz`
- `rdlabo-workers-mysql-*.tgz`

Install all three when testing the complete package boundary:

```sh
npm install drizzle-orm ai-gateway-provider ./rdlabo-workers-mysql-*.tgz ./rdlabo-workers-timezone-*.tgz ./rdlabo-workers-hono-kit-*.tgz
```

The `/beta`, automatic beta, `next`, and stable publication paths fail closed while either workspace
is private. Publication must remain disabled until release automation publishes timezone and MySQL
before the Hono kit and synchronizes all versions and dependency ranges. Candidate publication also
requires the repository variable `WORKSPACE_NPM_PUBLISH_ENABLED=true`; the workflow revalidates both
workspace manifests immediately before the publish boundary.

## Local development / linking

If you consume this package via a local path (e.g. `"@rdlabo/workers-hono-kit": "../../hono-kit"`) rather than from npm, TypeScript and esbuild resolve the package's bare imports from _its own_ `node_modules`, which can create a second `zod` instance. That breaks types where your zod-inferred values flow into other libraries (e.g. Drizzle inserts). Dedupe with tsconfig `paths`:

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "zod": ["node_modules/zod"],
      "zod/*": ["node_modules/zod/*"],
      "@hono/zod-validator": ["node_modules/@hono/zod-validator"],
    },
  },
}
```

When installed from npm normally, package managers dedupe `zod` to a single copy and this is not needed.

When developing against the kit via a direct `file:` link, run `npm install` in the kit repo itself to satisfy its peers (do not add `overrides` on the consumer side).

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

The owner has completed the initial local publication of `@rdlabo/workers-timezone@0.1.0` and
`@rdlabo/workers-mysql@0.1.0`. The existing Hono kit does not need another bootstrap publish;
`0.12.0` is released through the normal tag workflow. Pull requests and merges build immutable
candidate tarballs for all three packages:

- `rdlabo-workers-hono-kit-*.tgz`
- `rdlabo-workers-timezone-*.tgz`
- `rdlabo-workers-mysql-*.tgz`

Install all three when testing the complete package boundary:

```sh
npm install drizzle-orm ai-gateway-provider ./rdlabo-workers-mysql-*.tgz ./rdlabo-workers-timezone-*.tgz ./rdlabo-workers-hono-kit-*.tgz
```

All CI publishing requires the repository variable `WORKSPACE_NPM_PUBLISH_ENABLED=true`. Keep it
unset or false until the two workspace publications are visible on npm and the Trusted Publisher
and repository protection settings below are complete. This is an ongoing CI publication switch,
not a requirement to publish every package locally.
The publisher validates all three archives before any write, then publishes timezone, MySQL, and
the kit in that order. A retry skips a version only when the registry's SHA-512 integrity matches
the local tarball; different content under an existing version fails and requires a version bump.

## Bootstrap complete: verify before enabling CI

Only the two new packages required an initial owner publish. Do not repeat their `0.1.0` publishes
or publish Hono kit `0.12.0` locally just to enable CI. The kit's minor bump covers breaking import
and timezone behavior changes and remains a normal release.

Use Node.js 24 with a current npm CLI. From a clean checkout at the reviewed commit, verify the
release bundle without publishing:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run test:release
npm run test:package
RELEASE_DIR=$(mktemp -d)
npm pack --ignore-scripts --workspaces --include-workspace-root --pack-destination "$RELEASE_DIR"
node scripts/publish-packages.mjs --directory "$RELEASE_DIR" --manifests . --tag latest
```

The last command only validates and prints the plan: it does not publish or contact npm.
Confirm that the two bootstrap versions are visible on the public registry:

```sh
npm view @rdlabo/workers-timezone@0.1.0 version --registry https://registry.npmjs.org/
npm view @rdlabo/workers-mysql@0.1.0 version --registry https://registry.npmjs.org/
```

If either lookup fails, resolve registry visibility before enabling CI. Keep the published workspace
contents unchanged: the tag workflow compares archive integrity and skips identical `0.1.0` versions
before publishing the kit. Changes to any packaged workspace file require a new workspace version.

## Trusted Publishing setup after the first publish

For **each of the three npm packages**, open npmjs.com → package → Settings → Trusted publishing
and add or verify GitHub Actions with these exact values. Retain the kit's existing configuration
if it already matches:

| Field                    | Value                                                        |
| ------------------------ | ------------------------------------------------------------ |
| Organization / user      | `rdlabo-dev`                                                 |
| Repository               | `workers-hono-kit`                                           |
| Workflow filename        | `release.yml`                                                |
| Environment              | Leave empty (the workflow does not use a GitHub environment) |
| Allowed action, if shown | Direct `npm publish`                                         |

These npm-side settings can only be applied after the package exists; they are not created by a PR.
See [npm's Trusted Publishing guide](https://docs.npmjs.com/trusted-publishers/).
Before enabling CI, test the two registry packages together with the locally packed, not-yet-published
kit in a fresh consumer directory (using `RELEASE_DIR` from above):

```sh
npm install @rdlabo/workers-timezone@0.1.0 @rdlabo/workers-mysql@0.1.0 "$RELEASE_DIR/rdlabo-workers-hono-kit-0.12.0.tgz" drizzle-orm
npm install -D @types/node@20
```

Before enabling CI, create an **active tag ruleset** for `v*` in GitHub repository Settings → Rules:
restrict tag creation, updates, and deletion; grant bypass only to the designated release maintainer.
That maintainer must tag only reviewed commits on `main`. The tag workflow runs code from the tag,
so unrestricted tag creation would bypass the PR review boundary. Keep the default branch protected
and require review for workflow/publisher changes as well. These repository settings are not applied
by merging this PR.

Only after package verification, all three Trusted Publishers, and these repository protections are
in place, enable GitHub repository Actions variable `WORKSPACE_NPM_PUBLISH_ENABLED=true`.
CI uses OIDC and generates provenance; no npm token secret is needed.
Enabling the variable does not itself start a release. After merging the reviewed changes, a
`v0.12.0` tag triggers the kit release; future eligible merge/PR candidate events can publish betas.

## Subsequent releases

- A root `v<version>` tag must match the checked-in root package version. Stable versions publish
  with `latest`; prerelease versions publish with `next`. Each workspace uses its own version to
  select `latest` or `next`, independently of the root version.
- Increase each changed workspace's version and update the kit's peer range before a stable release.
  Unchanged workspace archives may be skipped only on an exact integrity match.
- `/beta` on a ready PR requires an owner/maintainer and successful Validation + Package Candidate
  runs. A PR changing release workflows or publisher/versioning scripts cannot publish a beta until
  those changes are reviewed and merged. Automatic merge beta has the same restriction.
- PR betas use the trusted `main` package versions: all three version fields must match `main`.
  Test version-bump PRs with the downloaded artifacts; their new versions can publish as merge
  betas after reaching `main`. A mismatched PR version is rejected before any registry write.
- Candidates publish all three immutable versions with one commit suffix and exact kit peer ranges.
  The success message includes all three versions in the install command.
- Candidate publication executes the publisher from the trusted default-branch commit. It reads
  archive metadata without extracting or running candidate code, and uses `--ignore-scripts`.

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

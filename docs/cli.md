# CLI

The package ships `bin` commands that can be run with `npx` or wired into npm scripts in the consuming app. They are operational helpers: AWS credential sync, subrequest fan-out gating, and brownfield database baselining.

| Command | Use |
| --- | --- |
| `workers-hono-kit-sync-dev-aws <wrangler-args…>` | Launch `wrangler` with AWS credentials injected as `--var`, resolved from the active AWS profile (honors `AWS_PROFILE`, supports short-lived SSO/temporary creds). Nothing is written to disk — replaces `.dev.vars`. Wire it as the `dev` script, e.g. `AWS_PROFILE=<p> workers-hono-kit-sync-dev-aws dev --var APP_ENV:development`. |
| `workers-hono-kit-check-subrequest-fanout [dir…]` | CI gate that greps for per-item external-call fan-outs (`runWithConcurrency(` / `PromisePool` / `.withConcurrency(`) that would eventually exceed the Workers subrequest cap. Annotate a genuinely-safe site with `subrequest-ok`. Scans `src` by default; exits 1 on an un-annotated marker. |
| `workers-hono-kit-db-baseline [--migrations ./drizzle]` | Brownfield first-deploy helper: record the baseline `0000` migration as *already applied* on an existing MySQL DB without running its DDL (the CLI wrapper around `baselineMigrations` / `readBaselineEntry`). Reads DB credentials from `DB_SECRET` (AWS RDS managed secret) or the individual `DB_*` env vars. |

## `workers-hono-kit-sync-dev-aws`

Use this in the `dev` npm script when you want AWS credentials from the active profile to be available inside `wrangler dev` without committing them to `.dev.vars`. It resolves short-lived SSO or temporary credentials and passes them as `--var` arguments. Nothing is written to disk.

```bash
AWS_PROFILE=my-sso-profile workers-hono-kit-sync-dev-aws dev --var APP_ENV:development
```

## `workers-hono-kit-check-subrequest-fanout`

Run this in CI to catch per-item external call patterns (for example `runWithConcurrency`, `PromisePool`, or `.withConcurrency`) that could fan out beyond the Workers subrequest cap. If a call site is safe, annotate it with `subrequest-ok`. The command scans `src` by default and exits with `1` if it finds an un-annotated marker.

```bash
workers-hono-kit-check-subrequest-fanout src
```

## `workers-hono-kit-db-baseline`

Use this for a brownfield first deploy against a MySQL database that already matches the schema in your first migration (`0000_*`). It records that migration as already applied without running its DDL, so later migrations can apply normally. Database credentials are read from `DB_SECRET` (an AWS RDS managed-secret JSON string) or from individual `DB_*` environment variables.

```bash
workers-hono-kit-db-baseline --migrations ./drizzle
```

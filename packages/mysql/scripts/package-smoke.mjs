import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = resolve(workspace, '..', '..');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'workers-mysql-smoke-'));
const commandEnvironment = {
  ...process.env,
  npm_config_cache: join(temporaryDirectory, 'npm-cache'),
};

try {
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryDirectory], {
      cwd: workspace,
      encoding: 'utf8',
      env: commandEnvironment,
    }),
  );
  const tarball = join(temporaryDirectory, packed[0].filename);
  const consumer = join(temporaryDirectory, 'consumer');
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync('npm', ['install', '--ignore-scripts', tarball, 'drizzle-orm@^0.45.2'], {
    cwd: consumer,
    stdio: 'inherit',
    env: commandEnvironment,
  });
  writeFileSync(
    join(consumer, 'smoke.mjs'),
    `import { MYSQL_TIMEZONE, toJstDate } from "@rdlabo/workers-mysql";
import { createNoopDatabase } from "@rdlabo/workers-mysql/testing";
if (MYSQL_TIMEZONE !== "+09:00") process.exit(1);
if (toJstDate("2026-07-01T15:00:00Z") !== "2026-07-02") process.exit(1);
if ((await createNoopDatabase().read("SELECT 1")).length !== 0) process.exit(1);
`,
  );
  writeFileSync(
    join(consumer, 'smoke.ts'),
    `import { type Database } from "@rdlabo/workers-mysql";
import { workersDrizzleConfig } from "@rdlabo/workers-mysql/drizzle";
import { type BaselineResult } from "@rdlabo/workers-mysql/migrations";
import { type TestDb } from "@rdlabo/workers-mysql/testing";
const config = workersDrizzleConfig({ database: "app" });
declare const database: Database<unknown>;
declare const testDb: TestDb;
declare const baseline: BaselineResult;
void config;
void database;
void testDb;
void baseline;
`,
  );
  writeFileSync(
    join(consumer, 'tsconfig.json'),
    '{"compilerOptions":{"strict":true,"module":"ESNext","moduleResolution":"Bundler","target":"ES2022","noEmit":true,"skipLibCheck":true},"include":["smoke.ts"]}\n',
  );
  execFileSync('node', ['smoke.mjs'], { cwd: consumer, stdio: 'inherit' });
  execFileSync(join(root, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], {
    cwd: consumer,
    stdio: 'inherit',
  });
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

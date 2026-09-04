import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'workers-workspace-smoke-'));
const commandEnvironment = {
  ...process.env,
  npm_config_cache: join(temporaryDirectory, 'npm-cache'),
};

function pack(workspace) {
  const args = ['pack', '--json', '--pack-destination', temporaryDirectory];
  if (workspace) {
    args.push('--workspace', workspace);
  }
  const result = JSON.parse(
    execFileSync('npm', args, {
      cwd: root,
      encoding: 'utf8',
      env: commandEnvironment,
    }),
  );
  return join(temporaryDirectory, result[0].filename);
}

try {
  const timezoneTarball = pack('@rdlabo/workers-timezone');
  const mysqlTarball = pack('@rdlabo/workers-mysql');
  const kitTarball = pack();
  const rootConsumer = join(temporaryDirectory, 'root-consumer');
  mkdirSync(rootConsumer);
  writeFileSync(join(rootConsumer, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync('npm', ['install', '--ignore-scripts', kitTarball, 'ai-gateway-provider@^3.1.0'], {
    cwd: rootConsumer,
    stdio: 'inherit',
    env: commandEnvironment,
  });
  if (existsSync(join(rootConsumer, 'node_modules', '@rdlabo', 'workers-timezone'))) {
    throw new Error('The optional timezone peer was installed for a root consumer');
  }
  if (existsSync(join(rootConsumer, 'node_modules', 'drizzle-orm'))) {
    throw new Error('The optional drizzle peer was installed for a root consumer');
  }
  if (existsSync(join(rootConsumer, 'node_modules', '@rdlabo', 'workers-mysql'))) {
    throw new Error('The optional MySQL package was installed for a root consumer');
  }
  if (existsSync(join(rootConsumer, 'node_modules', 'mysql2'))) {
    throw new Error('mysql2 was installed for a root consumer');
  }
  writeFileSync(
    join(rootConsumer, 'smoke.mjs'),
    `import * as kit from "@rdlabo/workers-hono-kit";
const { HttpStatus } = kit;
if (HttpStatus.OK !== 200) process.exit(1);
if ("createContainerRuntime" in kit) process.exit(1);
if ("retryWhenDeadlock" in kit) process.exit(1);
`,
  );
  writeFileSync(
    join(rootConsumer, 'smoke.ts'),
    `import { HttpStatus } from "@rdlabo/workers-hono-kit";
const ok: number = HttpStatus.OK;
void ok;
`,
  );
  writeFileSync(
    join(rootConsumer, 'tsconfig.json'),
    '{"compilerOptions":{"strict":true,"module":"ESNext","moduleResolution":"Bundler","target":"ES2022","noEmit":true,"skipLibCheck":true},"include":["smoke.ts"]}\n',
  );
  execFileSync('node', ['smoke.mjs'], { cwd: rootConsumer, stdio: 'inherit' });
  execFileSync(join(root, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], {
    cwd: rootConsumer,
    stdio: 'inherit',
  });

  const timezoneConsumer = join(temporaryDirectory, 'timezone-consumer');
  mkdirSync(timezoneConsumer);
  writeFileSync(join(timezoneConsumer, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync('npm', ['install', '--ignore-scripts', timezoneTarball, kitTarball, 'ai-gateway-provider@^3.1.0'], {
    cwd: timezoneConsumer,
    stdio: 'inherit',
    env: commandEnvironment,
  });
  writeFileSync(
    join(timezoneConsumer, 'smoke.mjs'),
    `import { initializeTimezone, toLocalDateTime } from "@rdlabo/workers-timezone";
import { getTimezoneConfig, toBusinessDateTime } from "@rdlabo/workers-hono-kit/business-time";
initializeTimezone({ timeZone: "America/New_York" });
const instant = new Date("2026-07-01T13:00:00Z");
if (toLocalDateTime(instant) !== "2026-07-01 09:00:00") process.exit(1);
if (toBusinessDateTime(instant) !== "2026-07-01 09:00:00") process.exit(1);
if (getTimezoneConfig().timeZone !== "America/New_York") process.exit(1);
`,
  );
  writeFileSync(
    join(timezoneConsumer, 'smoke.ts'),
    `import { type TimeZone } from "@rdlabo/workers-timezone";
import { type BusinessTimeZone } from "@rdlabo/workers-hono-kit/business-time";
const current: TimeZone = "Europe/London";
const legacy: BusinessTimeZone = current;
void legacy;
`,
  );
  writeFileSync(
    join(timezoneConsumer, 'tsconfig.json'),
    '{"compilerOptions":{"strict":true,"module":"ESNext","moduleResolution":"Bundler","target":"ES2022","noEmit":true,"skipLibCheck":true},"include":["smoke.ts"]}\n',
  );
  execFileSync('node', ['smoke.mjs'], { cwd: timezoneConsumer, stdio: 'inherit' });
  execFileSync(join(root, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], {
    cwd: timezoneConsumer,
    stdio: 'inherit',
  });

  const mysqlCoreConsumer = join(temporaryDirectory, 'mysql-core-consumer');
  mkdirSync(mysqlCoreConsumer);
  writeFileSync(join(mysqlCoreConsumer, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync('npm', ['install', '--ignore-scripts', mysqlTarball], {
    cwd: mysqlCoreConsumer,
    stdio: 'inherit',
    env: commandEnvironment,
  });
  if (existsSync(join(mysqlCoreConsumer, 'node_modules', 'drizzle-orm'))) {
    throw new Error('The optional drizzle peer was installed for a MySQL core consumer');
  }
  writeFileSync(
    join(mysqlCoreConsumer, 'smoke.mjs'),
    `import { MYSQL_TIMEZONE, toJstDate } from "@rdlabo/workers-mysql";
if (MYSQL_TIMEZONE !== "+09:00") process.exit(1);
if (toJstDate("1950-07-01T14:30:00Z") !== "1950-07-01") process.exit(1);
`,
  );
  execFileSync('node', ['smoke.mjs'], { cwd: mysqlCoreConsumer, stdio: 'inherit' });

  const databaseConsumer = join(temporaryDirectory, 'database-consumer');
  mkdirSync(databaseConsumer);
  writeFileSync(join(databaseConsumer, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', mysqlTarball, kitTarball, 'drizzle-orm@^0.45.2', 'ai-gateway-provider@^3.1.0'],
    {
      cwd: databaseConsumer,
      stdio: 'inherit',
      env: commandEnvironment,
    },
  );
  if (existsSync(join(databaseConsumer, 'node_modules', '@rdlabo', 'workers-timezone'))) {
    throw new Error('The optional timezone peer was installed for a database-only consumer');
  }
  writeFileSync(
    join(databaseConsumer, 'smoke.mjs'),
    `import { MYSQL_TIMEZONE, toJstDate } from "@rdlabo/workers-mysql";
import { workersDrizzleConfig } from "@rdlabo/workers-mysql/drizzle";
import { MYSQL_TIMEZONE as legacyTimezone, toJstDate as legacyToJstDate } from "@rdlabo/workers-hono-kit/db";
import { createContainerRuntime } from "@rdlabo/workers-hono-kit/mysql";
if (MYSQL_TIMEZONE !== "+09:00") process.exit(1);
if (legacyTimezone !== MYSQL_TIMEZONE) process.exit(1);
if (legacyToJstDate !== toJstDate) process.exit(1);
if (toJstDate("1950-07-01T14:30:00Z") !== "1950-07-01") process.exit(1);
if (workersDrizzleConfig({ database: "app" }).casing !== "snake_case") process.exit(1);
if (typeof createContainerRuntime !== "function") process.exit(1);
`,
  );
  writeFileSync(
    join(databaseConsumer, 'smoke.ts'),
    `import { MYSQL_TIMEZONE, toJstDate } from "@rdlabo/workers-mysql";
import { workersDrizzleConfig } from "@rdlabo/workers-mysql/drizzle";
import { createContainerRuntime } from "@rdlabo/workers-hono-kit/mysql";
const timezone: string = MYSQL_TIMEZONE;
const date: string | null = toJstDate("2026-07-01T00:00:00Z");
const config = workersDrizzleConfig({ database: "app" });
void timezone;
void date;
void config;
void createContainerRuntime;
`,
  );
  writeFileSync(
    join(databaseConsumer, 'tsconfig.json'),
    '{"compilerOptions":{"strict":true,"module":"ESNext","moduleResolution":"Bundler","target":"ES2022","noEmit":true,"skipLibCheck":true},"include":["smoke.ts"]}\n',
  );
  execFileSync('node', ['smoke.mjs'], { cwd: databaseConsumer, stdio: 'inherit' });
  execFileSync(join(root, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], {
    cwd: databaseConsumer,
    stdio: 'inherit',
  });
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

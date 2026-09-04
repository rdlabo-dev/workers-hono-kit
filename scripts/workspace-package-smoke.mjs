import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  const kitTarball = pack();
  writeFileSync(join(temporaryDirectory, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync('npm', ['install', '--ignore-scripts', timezoneTarball, kitTarball], {
    cwd: temporaryDirectory,
    stdio: 'inherit',
    env: commandEnvironment,
  });
  writeFileSync(
    join(temporaryDirectory, 'smoke.mjs'),
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
    join(temporaryDirectory, 'smoke.ts'),
    `import { type TimeZone } from "@rdlabo/workers-timezone";
import { type BusinessTimeZone } from "@rdlabo/workers-hono-kit/business-time";
const current: TimeZone = "Europe/London";
const legacy: BusinessTimeZone = current;
void legacy;
`,
  );
  writeFileSync(
    join(temporaryDirectory, 'tsconfig.json'),
    '{"compilerOptions":{"strict":true,"module":"ESNext","moduleResolution":"Bundler","target":"ES2022","noEmit":true,"skipLibCheck":true},"include":["smoke.ts"]}\n',
  );
  execFileSync('node', ['smoke.mjs'], { cwd: temporaryDirectory, stdio: 'inherit' });
  execFileSync(join(root, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], {
    cwd: temporaryDirectory,
    stdio: 'inherit',
  });
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

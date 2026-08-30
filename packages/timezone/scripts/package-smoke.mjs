import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'workers-timezone-smoke-'));
const commandEnvironment = {
  ...process.env,
  npm_config_cache: join(temporaryDirectory, 'npm-cache'),
};
const localTypeScript = join(root, 'node_modules', '.bin', 'tsc');
const typeScript = existsSync(localTypeScript)
  ? localTypeScript
  : join(root, '..', '..', 'node_modules', '.bin', 'tsc');

try {
  const packResult = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', temporaryDirectory], {
      cwd: root,
      encoding: 'utf8',
      env: commandEnvironment,
    }),
  );
  const tarball = join(temporaryDirectory, packResult[0].filename);
  writeFileSync(join(temporaryDirectory, 'package.json'), '{"private":true,"type":"module"}\n');
  execFileSync('npm', ['install', '--ignore-scripts', tarball], {
    cwd: temporaryDirectory,
    stdio: 'inherit',
    env: commandEnvironment,
  });
  writeFileSync(
    join(temporaryDirectory, 'smoke.mjs'),
    `import { TIME_ZONES, toLocalDateTime } from "@rdlabo/workers-timezone";
if (toLocalDateTime(new Date("2026-01-01T00:00:00Z"), TIME_ZONES.TOKYO) !== "2026-01-01 09:00:00") process.exit(1);
`,
  );
  writeFileSync(
    join(temporaryDirectory, 'smoke.ts'),
    `import { TIME_ZONES, type TimeZone } from "@rdlabo/workers-timezone";
const timeZone: TimeZone = TIME_ZONES.LONDON;
void timeZone;
`,
  );
  writeFileSync(
    join(temporaryDirectory, 'tsconfig.json'),
    '{"compilerOptions":{"strict":true,"module":"ESNext","moduleResolution":"Bundler","target":"ES2022","noEmit":true},"include":["smoke.ts"]}\n',
  );
  execFileSync('node', ['smoke.mjs'], {
    cwd: temporaryDirectory,
    stdio: 'inherit',
  });
  execFileSync(typeScript, ['-p', 'tsconfig.json'], {
    cwd: temporaryDirectory,
    stdio: 'inherit',
  });
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

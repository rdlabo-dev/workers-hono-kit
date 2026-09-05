import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const source = new URL('./sync-release-versions.mjs', import.meta.url);
const files = ['package.json', 'packages/timezone/package.json', 'packages/mysql/package.json', 'package-lock.json'];

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'workers-release-version-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const dir of ['scripts', 'packages/timezone', 'packages/mysql']) mkdirSync(join(cwd, dir), { recursive: true });
  copyFileSync(source, join(cwd, 'scripts/sync-release-versions.mjs'));
  const root = {
    name: '@rdlabo/workers-hono-kit',
    version: '0.12.0',
    private: true,
    workspaces: ['packages/*'],
    scripts: { version: 'node scripts/sync-release-versions.mjs' },
    peerDependencies: { '@rdlabo/workers-timezone': '^0.1.0', '@rdlabo/workers-mysql': '^0.1.0' },
  };
  const timezone = { name: '@rdlabo/workers-timezone', version: '0.1.0' };
  const mysql = {
    name: '@rdlabo/workers-mysql',
    version: '0.1.0',
    devDependencies: { '@rdlabo/workers-timezone': '^0.1.0' },
  };
  const lock = {
    name: root.name,
    version: root.version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': structuredClone(root),
      'packages/timezone': structuredClone(timezone),
      'packages/mysql': structuredClone(mysql),
      'node_modules/@rdlabo/workers-timezone': { resolved: 'packages/timezone', link: true },
      'node_modules/@rdlabo/workers-mysql': { resolved: 'packages/mysql', link: true },
    },
  };
  for (const [i, value] of [root, timezone, mysql, lock].entries())
    writeFileSync(join(cwd, files[i]), `${JSON.stringify(value, null, 2)}\n`);
  const run = (cmd, args) =>
    execFileSync(cmd, args, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...process.env,
        npm_config_cache: join(cwd, '.npm-cache'),
        npm_config_update_notifier: 'false',
        GIT_AUTHOR_NAME: 'Release Test',
        GIT_AUTHOR_EMAIL: 'test@example.invalid',
        GIT_COMMITTER_NAME: 'Release Test',
        GIT_COMMITTER_EMAIL: 'test@example.invalid',
      },
    });
  writeFileSync(join(cwd, '.gitignore'), 'node_modules/\n.npm-cache/\n');
  run('git', ['init', '-q']);
  run('git', ['config', 'commit.gpgsign', 'false']);
  run('git', ['config', 'tag.gpgsign', 'false']);
  run('git', ['add', '.']);
  run('git', ['commit', '-qm', 'fixture']);
  return { cwd, run };
}

for (const version of ['0.12.1', '0.13.0-rc.1']) {
  test(`npm version ${version} commits and tags the entire package set`, (t) => {
    const { cwd, run } = fixture(t);
    run('npm', ['version', version, '--no-audit', '--no-fund']);
    run('node', ['scripts/sync-release-versions.mjs', '--check']);
    for (const file of files) {
      const tagged = JSON.parse(run('git', ['show', `v${version}:${file}`]));
      assert.equal(tagged.version, version);
    }
    const root = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
    assert.equal(root.peerDependencies['@rdlabo/workers-mysql'], `^${version}`);
    const mysql = JSON.parse(readFileSync(join(cwd, 'packages/mysql/package.json'), 'utf8'));
    assert.equal(mysql.devDependencies['@rdlabo/workers-timezone'], `^${version}`);
    assert.equal(run('git', ['status', '--porcelain']).trim(), '');
    // npm must consume the rewritten lockfile offline, including prerelease links.
    run('npm', ['ci', '--ignore-scripts', '--offline', '--no-audit', '--no-fund']);
    assert.equal(run('git', ['status', '--porcelain']).trim(), '');
  });
}

test('check mode rejects unsynchronized versions without writing or tagging', (t) => {
  const { cwd, run } = fixture(t);
  const before = files.map((file) => readFileSync(join(cwd, file), 'utf8'));
  assert.throws(() => run('node', ['scripts/sync-release-versions.mjs', '--check']), /not aligned/);
  assert.deepEqual(
    files.map((file) => readFileSync(join(cwd, file), 'utf8')),
    before,
  );
  assert.equal(run('git', ['tag']).trim(), '');
});

test('no-tag npm version updates the set without committing or staging', (t) => {
  const { run } = fixture(t);
  const head = run('git', ['rev-parse', 'HEAD']);
  run('npm', ['version', '0.12.1', '--no-git-tag-version']);
  run('node', ['scripts/sync-release-versions.mjs', '--check']);
  assert.equal(run('git', ['rev-parse', 'HEAD']), head);
  assert.equal(run('git', ['diff', '--cached', '--name-only']).trim(), '');
  assert.equal(run('git', ['tag']).trim(), '');
});

test('the real repository lockfile keeps external dependencies and workspace links intact', (t) => {
  const { cwd, run } = fixture(t);
  for (const file of files) copyFileSync(new URL(`../${file}`, import.meta.url), join(cwd, file));
  const before = JSON.parse(readFileSync(join(cwd, 'package-lock.json'), 'utf8'));
  run('npm', ['version', '99.0.0-rc.1', '--no-git-tag-version']);
  run('node', ['scripts/sync-release-versions.mjs', '--check']);
  const after = JSON.parse(readFileSync(join(cwd, 'package-lock.json'), 'utf8'));
  for (const [key, entry] of Object.entries(before.packages)) {
    if (!['', 'packages/timezone', 'packages/mysql'].includes(key)) {
      assert.deepEqual(after.packages[key], entry, key);
    }
  }
  assert.equal(after.packages[''].peerDependencies['@rdlabo/workers-mysql'], '^99.0.0-rc.1');
  assert.equal(after.packages['packages/mysql'].devDependencies['@rdlabo/workers-timezone'], '^99.0.0-rc.1');
});

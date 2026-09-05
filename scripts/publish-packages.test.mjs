import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { NPM_REGISTRY, parseCliArguments, publishPackages, sha512Integrity } from './publish-packages.mjs';

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function publicManifest(name, version, extra = {}) {
  return {
    name,
    version,
    private: false,
    publishConfig: { access: 'public', registry: NPM_REGISTRY },
    ...extra,
  };
}

function fixture({ suffix, versions = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'publish-packages-test-'));
  temporaryDirectories.push(root);
  const manifests = join(root, 'trusted');
  const directory = join(root, 'archives');
  mkdirSync(join(manifests, 'packages', 'timezone'), { recursive: true });
  mkdirSync(join(manifests, 'packages', 'mysql'), { recursive: true });
  mkdirSync(directory);

  const trusted = {
    timezone: publicManifest('@rdlabo/workers-timezone', versions.timezone ?? '0.1.0'),
    mysql: publicManifest('@rdlabo/workers-mysql', versions.mysql ?? '0.2.0'),
    kit: publicManifest('@rdlabo/workers-hono-kit', versions.kit ?? '0.12.0', {
      peerDependencies: {
        '@rdlabo/workers-timezone': `^${versions.timezone ?? '0.1.0'}`,
        '@rdlabo/workers-mysql': `^${versions.mysql ?? '0.2.0'}`,
      },
    }),
  };
  writeFileSync(join(manifests, 'packages/timezone/package.json'), JSON.stringify(trusted.timezone));
  writeFileSync(join(manifests, 'packages/mysql/package.json'), JSON.stringify(trusted.mysql));
  writeFileSync(join(manifests, 'package.json'), JSON.stringify(trusted.kit));

  const version = (trustedVersion) =>
    suffix === undefined ? trustedVersion : `${trustedVersion.split(/[+-]/, 1)[0]}-${suffix}`;
  const artifactManifests = new Map();
  for (const [key, manifest] of Object.entries(trusted)) {
    const path = join(directory, `${key}.tgz`);
    writeFileSync(path, `archive:${key}:${suffix ?? 'stable'}`);
    artifactManifests.set(
      resolve(path),
      structuredClone({
        ...manifest,
        version: version(manifest.version),
      }),
    );
  }
  const kit = artifactManifests.get(resolve(join(directory, 'kit.tgz')));
  kit.peerDependencies = {
    '@rdlabo/workers-timezone':
      suffix === undefined ? `^${trusted.timezone.version}` : version(trusted.timezone.version),
    '@rdlabo/workers-mysql': suffix === undefined ? `^${trusted.mysql.version}` : version(trusted.mysql.version),
  };

  const calls = [];
  const runner = (command, args) => {
    calls.push([command, [...args]]);
    if (command === 'tar') {
      const manifest = artifactManifests.get(resolve(args[1]));
      return manifest === undefined
        ? { status: 2, stdout: '', stderr: 'unknown archive' }
        : { status: 0, stdout: JSON.stringify(manifest), stderr: '' };
    }
    return { status: 1, stdout: '', stderr: 'npm error code E404' };
  };
  return { root, manifests, directory, trusted, artifactManifests, calls, runner };
}

function commandRunner(testFixture, npmHandler = () => ({ status: 1, stderr: 'npm error code E404' })) {
  return (command, args) => {
    testFixture.calls.push([command, [...args]]);
    if (command === 'tar') {
      const manifest = testFixture.artifactManifests.get(resolve(args[1]));
      return { status: 0, stdout: JSON.stringify(manifest), stderr: '' };
    }
    return npmHandler(command, args);
  };
}

test('dry-run validates all artifacts and performs no npm network command', () => {
  const state = fixture();
  const output = [];
  const plan = publishPackages({
    directory: state.directory,
    manifests: state.manifests,
    tag: 'latest',
    commandRunner: state.runner,
    log: (line) => output.push(line),
  });

  assert.deepEqual(
    plan.map(({ name, action }) => [name, action]),
    [
      ['@rdlabo/workers-timezone', 'publish'],
      ['@rdlabo/workers-mysql', 'publish'],
      ['@rdlabo/workers-hono-kit', 'publish'],
    ],
  );
  assert.equal(state.calls.length, 3);
  assert.ok(state.calls.every(([command, args]) => command === 'tar' && args[0] === '-xOf'));
  assert.equal(output.length, 3);
});

test('candidate versions and exact kit workspace peers must match the trusted suffix', () => {
  const suffix = 'beta.pr43.sha012345abcdef';
  const state = fixture({ suffix });
  const plan = publishPackages({
    directory: state.directory,
    manifests: state.manifests,
    tag: 'beta',
    suffix,
    commandRunner: state.runner,
    log() {},
  });
  assert.ok(plan.every(({ version }) => version.endsWith(`-${suffix}`)));
  assert.deepEqual(
    plan.map(({ tag }) => tag),
    ['beta', 'beta', 'beta'],
  );

  state.artifactManifests.get(resolve(join(state.directory, 'kit.tgz'))).peerDependencies['@rdlabo/workers-mysql'] =
    '^0.2.0';
  assert.throws(
    () =>
      publishPackages({
        directory: state.directory,
        manifests: state.manifests,
        tag: 'beta',
        suffix,
        commandRunner: state.runner,
        log() {},
      }),
    /Kit archive MySQL peer must be 0\.2\.0-beta\.pr43\.sha012345abcdef/,
  );

  state.artifactManifests.get(resolve(join(state.directory, 'kit.tgz'))).peerDependencies['@rdlabo/workers-mysql'] =
    `0.2.0-${suffix}`;
  state.artifactManifests.get(resolve(join(state.directory, 'mysql.tgz'))).version = '0.2.0-beta.pr44.sha012345abcdef';
  assert.throws(
    () =>
      publishPackages({
        directory: state.directory,
        manifests: state.manifests,
        tag: 'beta',
        suffix,
        commandRunner: state.runner,
        log() {},
      }),
    /Archive identity mismatch for @rdlabo\/workers-mysql/,
  );
});

test('candidate versions replace a trusted prerelease with the immutable candidate suffix', () => {
  const suffix = 'beta.pr43.sha012345abcdef';
  const state = fixture({
    suffix,
    versions: { timezone: '0.1.1-rc.1', mysql: '0.2.1-rc.2', kit: '0.12.1-rc.3' },
  });
  const plan = publishPackages({
    directory: state.directory,
    manifests: state.manifests,
    tag: 'beta',
    suffix,
    commandRunner: state.runner,
    log() {},
  });
  assert.deepEqual(
    plan.map(({ version }) => version),
    [`0.1.1-${suffix}`, `0.2.1-${suffix}`, `0.12.1-${suffix}`],
  );
});

test('an official prerelease from a trusted tag checkout uses the next dist-tag without a candidate suffix', () => {
  const state = fixture({
    versions: { kit: '0.12.1-rc.1' },
  });
  const plan = publishPackages({
    directory: state.directory,
    manifests: state.manifests,
    tag: 'next',
    commandRunner: state.runner,
    log() {},
  });
  assert.deepEqual(
    plan.map(({ version }) => version),
    ['0.1.0', '0.2.0', '0.12.1-rc.1'],
  );
  assert.deepEqual(
    plan.map(({ tag }) => tag),
    ['latest', 'latest', 'next'],
  );
});

test('rejects a malicious artifact before any npm command', () => {
  const state = fixture();
  const timezone = state.artifactManifests.get(resolve(join(state.directory, 'timezone.tgz')));
  timezone.publishConfig.registry = 'https://evil.example/';

  assert.throws(
    () =>
      publishPackages({
        directory: state.directory,
        manifests: state.manifests,
        tag: 'latest',
        publish: true,
        commandRunner: state.runner,
        log() {},
      }),
    /unexpected publish registry/,
  );
  assert.ok(state.calls.every(([command]) => command === 'tar'));

  const missingRegistry = fixture();
  delete missingRegistry.artifactManifests.get(resolve(join(missingRegistry.directory, 'mysql.tgz'))).publishConfig
    .registry;
  assert.throws(
    () =>
      publishPackages({
        directory: missingRegistry.directory,
        manifests: missingRegistry.manifests,
        tag: 'latest',
        publish: true,
        commandRunner: missingRegistry.runner,
        log() {},
      }),
    /registry does not match the trusted manifest/,
  );

  const duplicate = fixture();
  const duplicateArchive = duplicate.artifactManifests.get(resolve(join(duplicate.directory, 'mysql.tgz')));
  duplicateArchive.name = '@rdlabo/workers-timezone';
  duplicateArchive.version = '0.1.0';
  assert.throws(
    () =>
      publishPackages({
        directory: duplicate.directory,
        manifests: duplicate.manifests,
        tag: 'latest',
        publish: true,
        commandRunner: duplicate.runner,
        log() {},
      }),
    /More than one archive claims package name/,
  );
  assert.ok(duplicate.calls.every(([command]) => command === 'tar'));
});

test('rejects an untrusted manifest before reading archives', () => {
  const state = fixture();
  state.trusted.timezone.private = true;
  writeFileSync(join(state.manifests, 'packages/timezone/package.json'), JSON.stringify(state.trusted.timezone));
  assert.throws(
    () =>
      publishPackages({
        directory: state.directory,
        manifests: state.manifests,
        tag: 'latest',
        commandRunner: state.runner,
        log() {},
      }),
    /must set private to false/,
  );
  assert.equal(state.calls.length, 0);

  const buildMetadata = fixture({ versions: { kit: '0.12.0+build-1' } });
  assert.throws(
    () =>
      publishPackages({
        directory: buildMetadata.directory,
        manifests: buildMetadata.manifests,
        tag: 'latest',
        commandRunner: buildMetadata.runner,
        log() {},
      }),
    /must have a SemVer version/,
  );
});

test('publishes missing packages in dependency order with fixed safety flags', () => {
  const state = fixture();
  state.calls.length = 0;
  const runner = commandRunner(state, (command, args) => {
    if (command === 'npm' && args[0] === 'view') return { status: 1, stderr: 'npm error code E404' };
    return { status: 0, stdout: '', stderr: '' };
  });
  const plan = publishPackages({
    directory: state.directory,
    manifests: state.manifests,
    tag: 'latest',
    publish: true,
    commandRunner: runner,
    log() {},
  });

  assert.deepEqual(
    plan.map(({ action }) => action),
    ['published', 'published', 'published'],
  );
  const npmCalls = state.calls.filter(([command]) => command === 'npm').map(([, args]) => args);
  assert.deepEqual(
    npmCalls.map((args) => [args[0], args[0] === 'view' ? args[1] : basename(args[1])]),
    [
      ['view', '@rdlabo/workers-timezone@0.1.0'],
      ['view', '@rdlabo/workers-mysql@0.2.0'],
      ['view', '@rdlabo/workers-hono-kit@0.12.0'],
      ['publish', 'timezone.tgz'],
      ['publish', 'mysql.tgz'],
      ['publish', 'kit.tgz'],
    ],
  );
  for (const args of npmCalls.filter(([operation]) => operation === 'publish')) {
    assert.deepEqual(args.slice(2), [
      '--ignore-scripts',
      '--provenance',
      '--access',
      'public',
      '--registry',
      NPM_REGISTRY,
      '--tag',
      'latest',
    ]);
  }
});

test('a rerun skips only archives whose published integrity is identical', () => {
  const state = fixture();
  const runner = commandRunner(state, (_command, args) => {
    assert.equal(args[0], 'view');
    const packageName = args[1].slice(0, args[1].lastIndexOf('@'));
    const key = packageName.endsWith('workers-timezone')
      ? 'timezone'
      : packageName.endsWith('workers-mysql')
        ? 'mysql'
        : 'kit';
    return {
      status: 0,
      stdout: JSON.stringify(sha512Integrity(join(state.directory, `${key}.tgz`))),
      stderr: '',
    };
  });
  const plan = publishPackages({
    directory: state.directory,
    manifests: state.manifests,
    tag: 'latest',
    publish: true,
    commandRunner: runner,
    log() {},
  });

  assert.deepEqual(
    plan.map(({ action }) => action),
    ['skip', 'skip', 'skip'],
  );
  assert.equal(state.calls.filter(([command, args]) => command === 'npm' && args[0] === 'publish').length, 0);
});

test('a partial rerun skips an identical dependency and publishes the rest in order', () => {
  const state = fixture();
  const runner = commandRunner(state, (_command, args) => {
    if (args[0] === 'view') {
      if (args[1].includes('workers-timezone')) {
        return {
          status: 0,
          stdout: JSON.stringify(sha512Integrity(join(state.directory, 'timezone.tgz'))),
          stderr: '',
        };
      }
      return { status: 1, stdout: '', stderr: 'npm error code E404' };
    }
    return { status: 0, stdout: '', stderr: '' };
  });
  const plan = publishPackages({
    directory: state.directory,
    manifests: state.manifests,
    tag: 'latest',
    publish: true,
    commandRunner: runner,
    log() {},
  });
  assert.deepEqual(
    plan.map(({ action }) => action),
    ['skip', 'published', 'published'],
  );
  assert.deepEqual(
    state.calls
      .filter(([command, args]) => command === 'npm' && args[0] === 'publish')
      .map(([, args]) => basename(args[1])),
    ['mysql.tgz', 'kit.tgz'],
  );
});

test('refuses an existing version with different integrity', () => {
  const state = fixture();
  const runner = commandRunner(state, () => ({ status: 0, stdout: '"sha512-different"', stderr: '' }));
  assert.throws(
    () =>
      publishPackages({
        directory: state.directory,
        manifests: state.manifests,
        tag: 'latest',
        publish: true,
        commandRunner: runner,
        log() {},
      }),
    /Published integrity mismatch for @rdlabo\/workers-timezone@0\.1\.0/,
  );
  assert.equal(state.calls.filter(([command, args]) => command === 'npm' && args[0] === 'publish').length, 0);

  const missing = fixture();
  const missingRunner = commandRunner(missing, () => ({ status: 0, stdout: '', stderr: '' }));
  assert.throws(
    () =>
      publishPackages({
        directory: missing.directory,
        manifests: missing.manifests,
        tag: 'latest',
        publish: true,
        commandRunner: missingRunner,
        log() {},
      }),
    /returned no dist\.integrity/,
  );
  assert.equal(missing.calls.filter(([command, args]) => command === 'npm' && args[0] === 'publish').length, 0);
});

test('treats only E404 as unpublished', () => {
  const state = fixture();
  let viewCount = 0;
  const runner = commandRunner(state, () => {
    viewCount += 1;
    return viewCount === 3
      ? { status: 1, stdout: '', stderr: 'npm error code E500' }
      : { status: 1, stdout: '', stderr: 'npm error code E404' };
  });
  assert.throws(
    () =>
      publishPackages({
        directory: state.directory,
        manifests: state.manifests,
        tag: 'latest',
        publish: true,
        commandRunner: runner,
        log() {},
      }),
    /npm view failed.*E500/,
  );
  assert.equal(state.calls.filter(([command, args]) => command === 'npm' && args[0] === 'publish').length, 0);

  const ambiguous = fixture();
  const ambiguousRunner = commandRunner(ambiguous, () => ({
    status: 1,
    stdout: '',
    stderr: 'network proxy mentioned E404 but returned E500',
  }));
  assert.throws(
    () =>
      publishPackages({
        directory: ambiguous.directory,
        manifests: ambiguous.manifests,
        tag: 'latest',
        publish: true,
        commandRunner: ambiguousRunner,
        log() {},
      }),
    /npm view failed/,
  );
});

test('CLI arguments enforce stable and candidate tag modes', () => {
  assert.deepEqual(parseCliArguments(['--directory', '/archives', '--manifests', '/repo', '--tag', 'latest']), {
    directory: '/archives',
    manifests: '/repo',
    tag: 'latest',
    publish: false,
  });
  assert.throws(
    () =>
      publishPackages({
        directory: '/archives',
        manifests: '/repo',
        tag: 'beta',
        commandRunner() {},
      }),
    /requires --suffix/,
  );
});

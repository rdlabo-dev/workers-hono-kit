import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const NPM_REGISTRY = 'https://registry.npmjs.org/';

const packageDefinitions = [
  {
    name: '@rdlabo/workers-timezone',
    manifestPath: 'packages/timezone/package.json',
  },
  {
    name: '@rdlabo/workers-mysql',
    manifestPath: 'packages/mysql/package.json',
  },
  {
    name: '@rdlabo/workers-hono-kit',
    manifestPath: 'package.json',
  },
];

const supportedTags = new Set(['latest', 'next', 'beta']);
const stableVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const versionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const candidateSuffixPattern = /^(?:beta\.pr\d+|candidate)\.sha[0-9a-f]{12}$/;

function fail(message) {
  throw new Error(message);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(value, description) {
  try {
    const parsed = JSON.parse(value);
    if (!isRecord(parsed)) fail(`${description} must contain a JSON object`);
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) fail(`${description} is not valid JSON: ${error.message}`);
    throw error;
  }
}

function declaredRegistry(manifest) {
  const configured = isRecord(manifest.publishConfig) ? manifest.publishConfig.registry : undefined;
  if (configured === 'https://registry.npmjs.org') return NPM_REGISTRY;
  return configured;
}

function effectiveRegistry(manifest) {
  return declaredRegistry(manifest) ?? NPM_REGISTRY;
}

function validatePublicManifest(manifest, description) {
  if (manifest.private !== false) fail(`${description} must set private to false`);
  if (!isRecord(manifest.publishConfig) || manifest.publishConfig.access !== 'public') {
    fail(`${description} must set publishConfig.access to public`);
  }
  const registry = effectiveRegistry(manifest);
  if (registry !== NPM_REGISTRY) {
    fail(`${description} has an unexpected publish registry: ${String(registry)}`);
  }
}

function expectedCandidateVersion(version, suffix) {
  const coreVersion = version.split(/[+-]/, 1)[0];
  if (!stableVersionPattern.test(coreVersion)) fail(`Trusted candidate base version is invalid: ${version}`);
  return `${coreVersion}-${suffix}`;
}

function validateReleaseMode(tag, suffix) {
  if (!supportedTags.has(tag)) fail(`Unsupported dist-tag: ${tag}`);
  if (suffix === undefined) {
    if (tag === 'beta') fail('The beta dist-tag requires --suffix');
    return;
  }
  if (!candidateSuffixPattern.test(suffix)) {
    fail('Candidate suffix must be beta.pr<PR>.sha<SHA12> or candidate.sha<SHA12>');
  }
  const expectedTag = suffix.startsWith('beta.pr') ? 'beta' : 'next';
  if (tag !== expectedTag) fail(`Candidate suffix ${suffix} requires the ${expectedTag} dist-tag`);
}

function defaultCommandRunner(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function run(commandRunner, command, args) {
  let result;
  try {
    result = commandRunner(command, args);
  } catch (error) {
    fail(`Could not execute ${command}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(result)) fail(`Command runner returned no result for ${command}`);
  const status = result.status ?? result.exitCode;
  return {
    status,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
    error: result.error,
  };
}

function commandFailure(result) {
  if (result.error instanceof Error) return result.error.message;
  return result.stderr.trim() || result.stdout.trim() || `exit status ${String(result.status)}`;
}

function readTrustedManifests(manifestsDirectory) {
  const trustedRoot = resolve(manifestsDirectory);
  const trusted = new Map();
  for (const definition of packageDefinitions) {
    const path = resolve(trustedRoot, definition.manifestPath);
    let manifest;
    try {
      manifest = parseJson(readFileSync(path, 'utf8'), `Trusted manifest ${definition.manifestPath}`);
    } catch (error) {
      if (error instanceof Error && error.code === 'ENOENT') {
        fail(`Trusted manifest is missing: ${definition.manifestPath}`);
      }
      throw error;
    }
    if (manifest.name !== definition.name) {
      fail(`Trusted manifest ${definition.manifestPath} has unexpected name: ${String(manifest.name)}`);
    }
    if (typeof manifest.version !== 'string' || !versionPattern.test(manifest.version)) {
      fail(`Trusted manifest ${definition.manifestPath} must have a SemVer version`);
    }
    validatePublicManifest(manifest, `Trusted manifest ${definition.manifestPath}`);
    trusted.set(definition.name, { manifest });
  }

  const root = trusted.get('@rdlabo/workers-hono-kit').manifest;
  const timezone = trusted.get('@rdlabo/workers-timezone').manifest;
  const mysql = trusted.get('@rdlabo/workers-mysql').manifest;
  if (!isRecord(root.peerDependencies)) fail('Trusted kit manifest must define peerDependencies');
  if (root.peerDependencies['@rdlabo/workers-timezone'] !== `^${timezone.version}`) {
    fail('Trusted kit timezone peer must be the caret range of the trusted timezone version');
  }
  if (root.peerDependencies['@rdlabo/workers-mysql'] !== `^${mysql.version}`) {
    fail('Trusted kit MySQL peer must be the caret range of the trusted MySQL version');
  }
  return trusted;
}

function validateTrustedReleaseTag(trusted, tag, suffix) {
  if (suffix !== undefined) return;
  const rootVersion = trusted.get('@rdlabo/workers-hono-kit').manifest.version;
  const expectedTag = rootVersion.includes('-') ? 'next' : 'latest';
  if (tag !== expectedTag) fail(`Trusted kit version ${rootVersion} requires the ${expectedTag} dist-tag`);
}

function readArtifactManifest(path, commandRunner) {
  const result = run(commandRunner, 'tar', ['-xOf', path, 'package/package.json']);
  if (result.status !== 0) fail(`Could not read package/package.json from ${path}: ${commandFailure(result)}`);
  return parseJson(result.stdout, `Archive manifest in ${path}`);
}

function archivePaths(directory) {
  const resolvedDirectory = resolve(directory);
  let entries;
  try {
    entries = readdirSync(resolvedDirectory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error) fail(`Could not read archive directory ${resolvedDirectory}: ${error.message}`);
    throw error;
  }
  const archives = entries.filter((entry) => entry.name.endsWith('.tgz'));
  if (archives.length !== packageDefinitions.length) {
    fail(`Expected exactly three .tgz archives, found ${archives.length}`);
  }
  for (const archive of archives) {
    if (!archive.isFile()) fail(`Package archive must be a regular file: ${archive.name}`);
  }
  return archives.map((entry) => resolve(resolvedDirectory, entry.name));
}

function validateArchives(directory, trusted, suffix, commandRunner) {
  const artifacts = new Map();
  for (const path of archivePaths(directory)) {
    const manifest = readArtifactManifest(path, commandRunner);
    const expected = trusted.get(manifest.name);
    if (expected === undefined) fail(`Archive has unexpected package name: ${String(manifest.name)}`);
    if (artifacts.has(manifest.name)) fail(`More than one archive claims package name ${manifest.name}`);

    const expectedVersion =
      suffix === undefined ? expected.manifest.version : expectedCandidateVersion(expected.manifest.version, suffix);
    if (manifest.version !== expectedVersion) {
      fail(
        `Archive identity mismatch for ${manifest.name}: expected ${expectedVersion}, found ${String(manifest.version)}`,
      );
    }
    validatePublicManifest(manifest, `Archive manifest for ${manifest.name}`);
    if (declaredRegistry(manifest) !== declaredRegistry(expected.manifest)) {
      fail(`Archive registry does not match the trusted manifest for ${manifest.name}`);
    }
    artifacts.set(manifest.name, { ...expected, manifest, path });
  }

  for (const definition of packageDefinitions) {
    if (!artifacts.has(definition.name)) fail(`Archive is missing package ${definition.name}`);
  }

  const kit = artifacts.get('@rdlabo/workers-hono-kit').manifest;
  const timezone = artifacts.get('@rdlabo/workers-timezone').manifest;
  const mysql = artifacts.get('@rdlabo/workers-mysql').manifest;
  if (!isRecord(kit.peerDependencies)) fail('Kit archive must define peerDependencies');
  const expectedTimezonePeer = suffix === undefined ? `^${timezone.version}` : timezone.version;
  const expectedMysqlPeer = suffix === undefined ? `^${mysql.version}` : mysql.version;
  if (kit.peerDependencies['@rdlabo/workers-timezone'] !== expectedTimezonePeer) {
    fail(`Kit archive timezone peer must be ${expectedTimezonePeer}`);
  }
  if (kit.peerDependencies['@rdlabo/workers-mysql'] !== expectedMysqlPeer) {
    fail(`Kit archive MySQL peer must be ${expectedMysqlPeer}`);
  }
  return packageDefinitions.map(({ name }) => artifacts.get(name));
}

export function sha512Integrity(path) {
  return `sha512-${createHash('sha512').update(readFileSync(path)).digest('base64')}`;
}

function publishedIntegrity(result, identity) {
  if (result.status !== 0) {
    const output = `${result.stderr}\n${result.stdout}`.trim();
    let jsonCode;
    try {
      const parsed = JSON.parse(output);
      jsonCode = parsed?.error?.code ?? parsed?.code;
    } catch {
      // npm normally writes its human-readable error form to stderr.
    }
    if (jsonCode === 'E404' || /(?:^|\n)(?:npm (?:error|ERR!) )?code E404(?:\s|$)/.test(output)) {
      return undefined;
    }
    fail(`npm view failed for ${identity}: ${commandFailure(result)}`);
  }
  const value = result.stdout.trim();
  if (value === '') fail(`npm view returned no dist.integrity for ${identity}`);
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'string' && parsed !== '') return parsed;
  } catch {
    if (value.startsWith('sha512-')) return value;
  }
  fail(`npm view returned an invalid dist.integrity for ${identity}`);
}

export function publishPackages({
  directory,
  manifests,
  tag,
  suffix,
  publish = false,
  commandRunner = defaultCommandRunner,
  log = console.log,
}) {
  if (typeof directory !== 'string' || directory === '') fail('A tarball directory is required');
  if (typeof manifests !== 'string' || manifests === '') fail('A trusted manifest root is required');
  validateReleaseMode(tag, suffix);
  const trusted = readTrustedManifests(manifests);
  validateTrustedReleaseTag(trusted, tag, suffix);
  const artifacts = validateArchives(directory, trusted, suffix, commandRunner);
  const plan = artifacts.map(({ manifest, path }) => ({
    name: manifest.name,
    version: manifest.version,
    path,
    integrity: sha512Integrity(path),
    tag: suffix === undefined ? (manifest.version.includes('-') ? 'next' : 'latest') : tag,
    action: 'publish',
  }));

  if (!publish) {
    for (const item of plan) {
      log(`PLAN publish ${item.name}@${item.version} --tag ${item.tag} --registry ${NPM_REGISTRY}`);
    }
    return plan;
  }

  // Resolve every immutable-version check before the first publish, so a registry
  // or integrity error cannot leave a dependency-only partial release.
  for (const item of plan) {
    const identity = `${item.name}@${item.version}`;
    const view = run(commandRunner, 'npm', ['view', identity, 'dist.integrity', '--registry', NPM_REGISTRY, '--json']);
    const remoteIntegrity = publishedIntegrity(view, identity);
    if (remoteIntegrity !== undefined) {
      if (remoteIntegrity !== item.integrity) {
        fail(`Published integrity mismatch for ${identity}; refusing to overwrite or skip`);
      }
      item.action = 'skip';
      log(`SKIP ${identity}: identical archive is already published`);
    }
  }

  for (const item of plan) {
    if (item.action === 'skip') continue;
    const identity = `${item.name}@${item.version}`;
    if (sha512Integrity(item.path) !== item.integrity) {
      fail(`Archive changed after validation for ${identity}`);
    }
    const result = run(commandRunner, 'npm', [
      'publish',
      item.path,
      '--ignore-scripts',
      '--provenance',
      '--access',
      'public',
      '--registry',
      NPM_REGISTRY,
      '--tag',
      item.tag,
    ]);
    if (result.status !== 0) fail(`npm publish failed for ${identity}: ${commandFailure(result)}`);
    item.action = 'published';
    log(`PUBLISHED ${identity}`);
  }
  return plan;
}

export function parseCliArguments(args) {
  const { values } = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    options: {
      directory: { type: 'string' },
      manifests: { type: 'string' },
      tag: { type: 'string' },
      suffix: { type: 'string' },
      publish: { type: 'boolean', default: false },
    },
  });
  if (values.directory === undefined) fail('Missing required --directory');
  if (values.manifests === undefined) fail('Missing required --manifests');
  if (values.tag === undefined) fail('Missing required --tag');
  return { ...values };
}

const isDirectExecution =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectExecution) {
  try {
    publishPackages(parseCliArguments(process.argv.slice(2)));
  } catch (error) {
    console.error(`publish-packages: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

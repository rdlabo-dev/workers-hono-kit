import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// npm invokes this version hook after bumping the root, before committing/tagging.
const check = process.argv[2] === '--check';
if (process.argv.length > (check ? 3 : 2)) throw new Error('Only --check is supported');
const paths = ['package.json', 'packages/timezone/package.json', 'packages/mysql/package.json', 'package-lock.json'];
const original = paths.map((path) => readFileSync(path, 'utf8'));
const [root, timezone, mysql, lock] = original.map((text) => JSON.parse(text));
const version = root.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version)) {
  throw new Error('Expected a release version without build metadata');
}
const packages = [root, timezone, mysql];
const keys = ['', 'packages/timezone', 'packages/mysql'];
const names = ['@rdlabo/workers-hono-kit', '@rdlabo/workers-timezone', '@rdlabo/workers-mysql'];
if (lock.lockfileVersion !== 3 || packages.some((pkg, i) => pkg.name !== names[i] || !lock.packages[keys[i]])) {
  throw new Error('Expected the three Workers packages and a v3 workspace lockfile');
}
for (const [i, pkg] of packages.entries()) {
  pkg.version = version;
  lock.packages[keys[i]].version = version;
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const name of names) {
      if (pkg[field]?.[name] === undefined) continue;
      pkg[field][name] = `^${version}`;
      if (!lock.packages[keys[i]][field]) throw new Error(`Missing lockfile ${field} for ${pkg.name}`);
      lock.packages[keys[i]][field][name] = `^${version}`;
    }
  }
}
lock.version = version;
const values = [...packages, lock];
if (check) {
  for (const [i, value] of values.entries()) {
    if (JSON.stringify(value) !== JSON.stringify(JSON.parse(original[i]))) {
      throw new Error(`${paths[i]} is not aligned with ${version}; use npm run release`);
    }
  }
} else {
  for (const [i, value] of values.entries()) writeFileSync(paths[i], `${JSON.stringify(value, null, 2)}\n`);
  // Include workspace edits in npm's release commit. Respect no-tag dry runs.
  if (!['', 'false'].includes(process.env.npm_config_git_tag_version)) {
    execFileSync('git', ['add', '--', ...paths], { stdio: 'inherit' });
  }
}
console.log(`All three packages ${check ? 'verified at' : 'aligned to'} ${version}`);

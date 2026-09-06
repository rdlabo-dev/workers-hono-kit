import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const suffix = process.argv[2];
if (!suffix || !/^(?:beta\.pr\d+|candidate)\.sha[0-9a-f]{12}$/.test(suffix)) {
  throw new Error('Expected beta.pr<PR>.sha<SHA12> or candidate.sha<SHA12>');
}

function readPackage(relativePath) {
  const path = resolve(relativePath);
  return { path, value: JSON.parse(readFileSync(path, 'utf8')) };
}

function candidateVersion(packageJson) {
  return `${packageJson.version.split('-')[0]}-${suffix}`;
}

function writePackage(pkg) {
  writeFileSync(pkg.path, `${JSON.stringify(pkg.value, null, 2)}\n`);
}

const kit = readPackage('packages/hono-kit/package.json');
const timezone = readPackage('packages/timezone/package.json');
const mysql = readPackage('packages/mysql/package.json');

kit.value.version = candidateVersion(kit.value);
timezone.value.version = candidateVersion(timezone.value);
mysql.value.version = candidateVersion(mysql.value);
kit.value.peerDependencies['@rdlabo/workers-timezone'] = timezone.value.version;
kit.value.peerDependencies['@rdlabo/workers-mysql'] = mysql.value.version;
mysql.value.devDependencies['@rdlabo/workers-timezone'] = timezone.value.version;

writePackage(kit);
writePackage(timezone);
writePackage(mysql);

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

const root = readPackage('package.json');
const timezone = readPackage('packages/timezone/package.json');
const mysql = readPackage('packages/mysql/package.json');

root.value.version = candidateVersion(root.value);
timezone.value.version = candidateVersion(timezone.value);
mysql.value.version = candidateVersion(mysql.value);
root.value.peerDependencies['@rdlabo/workers-timezone'] = timezone.value.version;
root.value.peerDependencies['@rdlabo/workers-mysql'] = mysql.value.version;
mysql.value.devDependencies['@rdlabo/workers-timezone'] = timezone.value.version;

writePackage(root);
writePackage(timezone);
writePackage(mysql);

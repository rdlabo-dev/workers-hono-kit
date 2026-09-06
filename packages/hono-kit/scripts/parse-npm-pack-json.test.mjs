import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNpmPackFilename } from './parse-npm-pack-json.mjs';

const workspace = '@rdlabo/workers-timezone';
const filename = 'rdlabo-workers-timezone-0.12.1.tgz';
const record = {
  name: workspace,
  filename,
  packed: '/tmp/rdlabo-workers-timezone-0.12.1.tgz',
};

test('parses npm 11 array pack JSON', () => {
  assert.equal(parseNpmPackFilename([record], workspace), filename);
});

test('parses npm 12 object pack JSON keyed by package name', () => {
  assert.equal(parseNpmPackFilename({ [workspace]: record }, workspace), filename);
});

test('rejects malformed pack JSON shapes', () => {
  assert.throws(() => parseNpmPackFilename(null, workspace), /array or object/);
  assert.throws(() => parseNpmPackFilename('nope', workspace), /array or object/);
  assert.throws(() => parseNpmPackFilename([{ name: workspace }], workspace), /unsafe or invalid filename/);
  assert.throws(() => parseNpmPackFilename([null], workspace), /invalid record/);
});

test('rejects a mismatched workspace name', () => {
  assert.throws(
    () => parseNpmPackFilename([record], '@rdlabo/workers-mysql'),
    /missing a record for @rdlabo\/workers-mysql/,
  );
  assert.throws(
    () => parseNpmPackFilename({ [workspace]: record }, '@rdlabo/workers-mysql'),
    /missing a record for @rdlabo\/workers-mysql/,
  );
});

test('rejects ambiguous multiple matching records', () => {
  assert.throws(() => parseNpmPackFilename([record, { ...record }], workspace), /2 records/);
  assert.throws(
    () =>
      parseNpmPackFilename(
        {
          [workspace]: record,
          '@rdlabo/workers-timezone-dup': { ...record },
        },
        workspace,
      ),
    /2 records/,
  );
});

test('rejects unsafe tarball filenames', () => {
  for (const unsafe of [
    '../rdlabo-workers-timezone-0.12.1.tgz',
    'dir/rdlabo-workers-timezone-0.12.1.tgz',
    'dir\\rdlabo-workers-timezone-0.12.1.tgz',
    'rdlabo-workers-timezone-0.12.1.tar.gz',
    '',
    12,
  ]) {
    assert.throws(
      () => parseNpmPackFilename([{ name: workspace, filename: unsafe }], workspace),
      /unsafe or invalid filename/,
    );
  }
});

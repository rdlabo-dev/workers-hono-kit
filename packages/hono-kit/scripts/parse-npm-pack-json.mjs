/**
 * Return the safe tarball basename from `npm pack --json` output.
 *
 * npm 11 emits an array of pack records. npm 12 with `--workspace` emits an
 * object keyed by package name. Both shapes are accepted; the caller must
 * supply the exact workspace package name to select.
 *
 * @param {unknown} packJson Parsed `npm pack --json` stdout.
 * @param {string} workspaceName Exact package name expected in the output.
 * @returns {string} Basename of the packed `.tgz` (no directory separators).
 */
export function parseNpmPackFilename(packJson, workspaceName) {
  if (typeof workspaceName !== 'string' || workspaceName.length === 0) {
    throw new Error('Expected a non-empty workspace package name');
  }

  const records = collectPackRecords(packJson);
  const matches = records.filter((record) => record.name === workspaceName);

  if (matches.length === 0) {
    throw new Error(`npm pack JSON is missing a record for ${workspaceName}`);
  }
  if (matches.length > 1) {
    throw new Error(`npm pack JSON has ${matches.length} records for ${workspaceName}`);
  }

  const { filename } = matches[0];
  if (!isSafeTarballBasename(filename)) {
    throw new Error(
      `npm pack JSON for ${workspaceName} has an unsafe or invalid filename: ${JSON.stringify(filename)}`,
    );
  }
  return filename;
}

/**
 * @param {unknown} packJson
 * @returns {Array<{ name?: unknown, filename?: unknown }>}
 */
function collectPackRecords(packJson) {
  if (Array.isArray(packJson)) {
    return packJson.map(asPackRecord);
  }
  if (packJson !== null && typeof packJson === 'object') {
    return Object.values(packJson).map(asPackRecord);
  }
  throw new Error(`npm pack JSON must be an array or object, received ${describeValue(packJson)}`);
}

/**
 * @param {unknown} value
 * @returns {{ name?: unknown, filename?: unknown }}
 */
function asPackRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`npm pack JSON contains an invalid record: ${describeValue(value)}`);
  }
  return /** @type {{ name?: unknown, filename?: unknown }} */ (value);
}

/**
 * @param {unknown} filename
 * @returns {filename is string}
 */
function isSafeTarballBasename(filename) {
  return (
    typeof filename === 'string' &&
    filename.length > 4 &&
    filename.endsWith('.tgz') &&
    !filename.includes('/') &&
    !filename.includes('\\') &&
    !filename.includes('..')
  );
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function describeValue(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

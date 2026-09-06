/**
 * Language-service / declaration-emit regression for kit-only compatibility deprecations.
 *
 * Promoted standalone APIs re-exported from kit `/db`, `/business-time`, and DB-related `/testing`
 * must surface `@deprecated` to consumers. Canonical standalone package exports and kit-owned
 * helpers must not acquire new deprecation tags.
 */
/* eslint-disable @typescript-eslint/no-deprecated -- exercises the compatibility surface */
import {
  MYSQL_TIMEZONE as mysqlTimezoneCanonical,
  createMysqlDatabase as createMysqlDatabaseCanonical,
} from '@rdlabo/workers-mysql';
import { workersDrizzleConfig as workersDrizzleConfigCanonical } from '@rdlabo/workers-mysql/drizzle';
import { baselineMigrations as baselineMigrationsCanonical } from '@rdlabo/workers-mysql/migrations';
import {
  createNoopDatabase as createNoopDatabaseCanonical,
  createTestDb as createTestDbCanonical,
} from '@rdlabo/workers-mysql/testing';
import {
  TIME_ZONES as timeZonesCanonical,
  toLocalDateTime as toLocalDateTimeCanonical,
} from '@rdlabo/workers-timezone';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIME_ZONES, toLocalDateTime } from './business-time/index.js';
import type { BusinessDate } from './business-time/index.js';
import {
  MYSQL_TIMEZONE,
  baselineMigrations,
  createMysqlDatabase,
  reopenGuardedPaymentFailedSet,
  workersDrizzleConfig,
} from './db/index.js';
import type { Database } from './db/index.js';
import { createContainerRuntime } from './mysql/index.js';
import { authHeaders } from './testing/auth.js';
import { FakeFirebaseVerifier } from './testing/fakes.js';
import { createNoopDatabase, createTestDb } from './testing/index.js';
import type { TestDb } from './testing/index.js';
import { fakePaymentIntent } from './testing/stripe-fixtures.js';
import { fakeKv, fakeQueue } from './testing/workers-bindings.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'kit-deprecation-'));

afterAll(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

const DEPRECATED_DIAGNOSTIC = 6385;

const pathMap: ts.MapLike<string[]> = {
  '@rdlabo/workers-hono-kit/db': [join(packageRoot, 'src/db/index.ts')],
  '@rdlabo/workers-hono-kit/business-time': [join(packageRoot, 'src/business-time/index.ts')],
  '@rdlabo/workers-hono-kit/testing': [join(packageRoot, 'src/testing/index.ts')],
  '@rdlabo/workers-hono-kit/mysql': [join(packageRoot, 'src/mysql/index.ts')],
  '@rdlabo/workers-mysql': [join(packageRoot, '../mysql/src/index.ts')],
  '@rdlabo/workers-mysql/drizzle': [join(packageRoot, '../mysql/src/drizzle.ts')],
  '@rdlabo/workers-mysql/migrations': [join(packageRoot, '../mysql/src/migrations.ts')],
  '@rdlabo/workers-mysql/testing': [join(packageRoot, '../mysql/src/testing/index.ts')],
  '@rdlabo/workers-timezone': [join(packageRoot, '../timezone/src/index.ts')],
};

function createLanguageService(files: Record<string, string>): ts.LanguageService {
  const compilerOptions: ts.CompilerOptions = {
    strict: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    skipLibCheck: true,
    verbatimModuleSyntax: true,
    paths: pathMap,
    baseUrl: temporaryDirectory,
  };

  const snapshots = new Map<string, string>(
    Object.entries(files).map(([name, text]) => [join(temporaryDirectory, name), text]),
  );

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getScriptFileNames: () => [...snapshots.keys()],
    getScriptVersion: () => '1',
    getScriptSnapshot: (fileName) => {
      const text = snapshots.get(fileName) ?? ts.sys.readFile(fileName);
      return text === undefined ? undefined : ts.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => temporaryDirectory,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    fileExists: (fileName) => snapshots.has(fileName) || ts.sys.fileExists(fileName),
    readFile: (fileName) => snapshots.get(fileName) ?? ts.sys.readFile(fileName),
    readDirectory: (path, extensions, exclude, include, depth) =>
      ts.sys.readDirectory(path, extensions, exclude, include, depth),
    directoryExists: (path) => ts.sys.directoryExists(path),
    getDirectories: (path) => ts.sys.getDirectories(path),
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };

  return ts.createLanguageService(host);
}

function deprecationMessages(service: ts.LanguageService, fileName: string): string[] {
  return service
    .getSuggestionDiagnostics(join(temporaryDirectory, fileName))
    .filter((diagnostic) => diagnostic.code === DEPRECATED_DIAGNOSTIC)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
}

function emitSourceDeclarations(rootNames: string[]): Map<string, string> {
  const options: ts.CompilerOptions = {
    strict: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    declaration: true,
    emitDeclarationOnly: true,
    skipLibCheck: true,
    outDir: join(temporaryDirectory, 'dist'),
    rootDir: join(packageRoot, '..'),
  };
  const host = ts.createCompilerHost(options);
  const program = ts.createProgram(rootNames, options, host);
  const emitted = new Map<string, string>();
  const result = program.emit(undefined, (fileName, text) => {
    emitted.set(fileName, text);
  });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  expect(errors.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '))).toEqual([]);
  return emitted;
}

function declarationFor(emitted: Map<string, string>, relativePath: string): string {
  const suffix = relativePath.replace(/\\/g, '/');
  for (const [fileName, text] of emitted) {
    if (fileName.replace(/\\/g, '/').endsWith(suffix)) {
      return text;
    }
  }
  throw new Error(`Missing declaration emit for ${relativePath}`);
}

function hasExportKeyword(node: ts.Node): boolean {
  return (ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
  );
}

function nodeHasDeprecatedTag(node: ts.Node): boolean {
  return ts.getJSDocDeprecatedTag(node) !== undefined;
}

/**
 * True when the exported declaration named `symbolName` carries its own `@deprecated` JSDoc tag.
 * Earlier module or sibling `@deprecated` comments must not leak onto later declarations.
 */
function hasDeprecatedTag(source: string, symbolName: string): boolean {
  const sourceFile = ts.createSourceFile(
    'declaration.d.ts',
    source,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  );

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && hasExportKeyword(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.name.text === symbolName) {
          return nodeHasDeprecatedTag(statement) || nodeHasDeprecatedTag(declaration);
        }
      }
      continue;
    }

    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name?.text === symbolName &&
      hasExportKeyword(statement)
    ) {
      return nodeHasDeprecatedTag(statement);
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        if (element.name.text === symbolName) {
          return nodeHasDeprecatedTag(element) || nodeHasDeprecatedTag(statement);
        }
      }
    }
  }

  return false;
}

describe('hasDeprecatedTag AST inspection', () => {
  it('attributes @deprecated only to the tagged declaration, including class/type coverage', () => {
    const fixture = `/**
 * Module docs may mention \`@deprecated\` without tagging exports.
 * @packageDocumentation
 */
/** @deprecated reason for a */
export declare const a: number;
export declare const b: number;
/** @deprecated */
export declare class DeprecatedClass {}
export declare class PlainClass {}
/** @deprecated */
export type DeprecatedType = string;
export type PlainType = string;
/** @deprecated */
export declare function deprecatedFn(): void;
export declare function plainFn(): void;
export { reopenGuardedPaymentFailedSet };
`;

    expect(hasDeprecatedTag(fixture, 'a')).toBe(true);
    expect(hasDeprecatedTag(fixture, 'b')).toBe(false);
    expect(hasDeprecatedTag(fixture, 'DeprecatedClass')).toBe(true);
    expect(hasDeprecatedTag(fixture, 'PlainClass')).toBe(false);
    expect(hasDeprecatedTag(fixture, 'DeprecatedType')).toBe(true);
    expect(hasDeprecatedTag(fixture, 'PlainType')).toBe(false);
    expect(hasDeprecatedTag(fixture, 'deprecatedFn')).toBe(true);
    expect(hasDeprecatedTag(fixture, 'plainFn')).toBe(false);
    expect(hasDeprecatedTag(fixture, 'reopenGuardedPaymentFailedSet')).toBe(false);
  });
});

describe('kit compatibility deprecation notices', () => {
  it('preserves runtime identity and export names for promoted APIs', () => {
    expect(createMysqlDatabase).toBe(createMysqlDatabaseCanonical);
    expect(MYSQL_TIMEZONE).toBe(mysqlTimezoneCanonical);
    expect(workersDrizzleConfig).toBe(workersDrizzleConfigCanonical);
    expect(baselineMigrations).toBe(baselineMigrationsCanonical);
    expect(toLocalDateTime).toBe(toLocalDateTimeCanonical);
    expect(TIME_ZONES).toBe(timeZonesCanonical);
    expect(createTestDb).toBe(createTestDbCanonical);
    expect(createNoopDatabase).toBe(createNoopDatabaseCanonical);
  });

  it('reports deprecated tags for legacy imports via the language service', () => {
    const consumerSource = `import {
  createMysqlDatabase,
  type Database,
  reopenGuardedPaymentFailedSet,
} from '@rdlabo/workers-hono-kit/db';
import {
  toLocalDateTime,
  type BusinessDate,
} from '@rdlabo/workers-hono-kit/business-time';
import {
  createTestDb,
  type TestDb,
  FakeFirebaseVerifier,
  authHeaders,
  fakeKv,
  fakeQueue,
  fakePaymentIntent,
} from '@rdlabo/workers-hono-kit/testing';
import { createContainerRuntime } from '@rdlabo/workers-hono-kit/mysql';
import {
  createMysqlDatabase as canonicalCreateMysqlDatabase,
  type Database as CanonicalDatabase,
} from '@rdlabo/workers-mysql';
import {
  toLocalDateTime as canonicalToLocalDateTime,
  type BusinessDate as CanonicalBusinessDate,
} from '@rdlabo/workers-timezone';
import { createTestDb as canonicalCreateTestDb } from '@rdlabo/workers-mysql/testing';

export const legacyCreate = createMysqlDatabase;
export type LegacyDatabase = Database<string>;
export const legacyToLocal = toLocalDateTime;
export type LegacyBusinessDate = BusinessDate;
export const legacyTestDb = createTestDb;
export type LegacyTestDb = TestDb;
export const kitPayment = reopenGuardedPaymentFailedSet;
export const kitRuntime = createContainerRuntime;
export const kitFirebase = FakeFirebaseVerifier;
export const kitAuth = authHeaders;
export const kitKv = fakeKv;
export const kitQueue = fakeQueue;
export const kitStripe = fakePaymentIntent;
export const canonicalCreate = canonicalCreateMysqlDatabase;
export type CanonicalDb = CanonicalDatabase<string>;
export const canonicalToLocal = canonicalToLocalDateTime;
export type CanonicalDate = CanonicalBusinessDate;
export const canonicalTest = canonicalCreateTestDb;
`;

    writeFileSync(join(temporaryDirectory, 'consumer.ts'), consumerSource);
    const service = createLanguageService({ 'consumer.ts': consumerSource });
    const messages = deprecationMessages(service, 'consumer.ts');

    expect(messages).toEqual(
      expect.arrayContaining([
        "'createMysqlDatabase' is deprecated.",
        "'Database' is deprecated.",
        "'toLocalDateTime' is deprecated.",
        "'BusinessDate' is deprecated.",
        "'createTestDb' is deprecated.",
        "'TestDb' is deprecated.",
      ]),
    );
    for (const name of [
      'reopenGuardedPaymentFailedSet',
      'createContainerRuntime',
      'FakeFirebaseVerifier',
      'authHeaders',
      'fakeKv',
      'fakeQueue',
      'fakePaymentIntent',
      'canonicalCreateMysqlDatabase',
      'CanonicalDatabase',
      'canonicalToLocalDateTime',
      'CanonicalBusinessDate',
      'canonicalCreateTestDb',
    ]) {
      expect(messages.filter((message) => message.includes(`'${name}'`))).toEqual([]);
    }

    const consumerPath = join(temporaryDirectory, 'consumer.ts');
    const canonicalAliasOffset = consumerSource.indexOf('createMysqlDatabase as canonicalCreateMysqlDatabase');
    const canonicalQuickInfo = service.getQuickInfoAtPosition(consumerPath, canonicalAliasOffset);
    expect(canonicalQuickInfo?.tags?.some((tag) => tag.name === 'deprecated')).toBeFalsy();

    const legacyAliasOffset = consumerSource.indexOf('createMysqlDatabase,');
    const legacyQuickInfo = service.getQuickInfoAtPosition(consumerPath, legacyAliasOffset);
    expect(legacyQuickInfo?.tags?.some((tag) => tag.name === 'deprecated')).toBe(true);

    const databaseOffset = consumerSource.indexOf('type Database,');
    const databaseQuickInfo = service.getQuickInfoAtPosition(consumerPath, databaseOffset + 'type '.length);
    expect(databaseQuickInfo?.tags?.some((tag) => tag.name === 'deprecated')).toBe(true);
  });

  it('emits @deprecated on kit compatibility declarations without marking kit-owned or canonical APIs', () => {
    const emitted = emitSourceDeclarations([
      join(packageRoot, 'src/db/index.ts'),
      join(packageRoot, 'src/business-time/index.ts'),
      join(packageRoot, 'src/testing/db.ts'),
      join(packageRoot, 'src/testing/fakes.ts'),
      join(packageRoot, 'src/testing/index.ts'),
      join(packageRoot, 'src/mysql/index.ts'),
      join(packageRoot, '../mysql/src/index.ts'),
      join(packageRoot, '../timezone/src/index.ts'),
      join(packageRoot, '../mysql/src/testing/index.ts'),
    ]);

    const dbDts = declarationFor(emitted, '/hono-kit/src/db/index.d.ts');
    expect(hasDeprecatedTag(dbDts, 'createMysqlDatabase')).toBe(true);
    expect(hasDeprecatedTag(dbDts, 'Database')).toBe(true);
    expect(hasDeprecatedTag(dbDts, 'reopenGuardedPaymentFailedSet')).toBe(false);
    expect(dbDts).toMatch(/export\s*\{[^}]*reopenGuardedPaymentFailedSet/);

    const businessTimeDts = declarationFor(emitted, '/hono-kit/src/business-time/index.d.ts');
    expect(hasDeprecatedTag(businessTimeDts, 'toLocalDateTime')).toBe(true);
    expect(hasDeprecatedTag(businessTimeDts, 'BusinessDate')).toBe(true);

    const testingDbDts = declarationFor(emitted, '/hono-kit/src/testing/db.d.ts');
    expect(hasDeprecatedTag(testingDbDts, 'createTestDb')).toBe(true);
    expect(hasDeprecatedTag(testingDbDts, 'TestDb')).toBe(true);
    expect(hasDeprecatedTag(testingDbDts, 'Database')).toBe(true);

    const testingFakesDts = declarationFor(emitted, '/hono-kit/src/testing/fakes.d.ts');
    expect(hasDeprecatedTag(testingFakesDts, 'createNoopDatabase')).toBe(true);
    expect(hasDeprecatedTag(testingFakesDts, 'FakeFirebaseVerifier')).toBe(false);

    const mysqlAdapterDts = declarationFor(emitted, '/hono-kit/src/mysql/index.d.ts');
    expect(hasDeprecatedTag(mysqlAdapterDts, 'createContainerRuntime')).toBe(false);

    const mysqlCanonicalDts = declarationFor(emitted, '/mysql/src/index.d.ts');
    expect(hasDeprecatedTag(mysqlCanonicalDts, 'createMysqlDatabase')).toBe(false);
    expect(hasDeprecatedTag(mysqlCanonicalDts, 'Database')).toBe(false);

    const timezoneCanonicalDts = declarationFor(emitted, '/timezone/src/index.d.ts');
    expect(hasDeprecatedTag(timezoneCanonicalDts, 'toLocalDateTime')).toBe(false);
    expect(hasDeprecatedTag(timezoneCanonicalDts, 'BusinessDate')).toBe(false);

    const mysqlTestingCanonicalDts = declarationFor(emitted, '/mysql/src/testing/index.d.ts');
    expect(hasDeprecatedTag(mysqlTestingCanonicalDts, 'createTestDb')).toBe(false);
    expect(hasDeprecatedTag(mysqlTestingCanonicalDts, 'TestDb')).toBe(false);
  });

  it('keeps kit-owned helpers available without wrapping promoted functions', () => {
    expect(typeof reopenGuardedPaymentFailedSet).toBe('function');
    expect(typeof createContainerRuntime).toBe('function');
    expect(typeof FakeFirebaseVerifier).toBe('function');
    expect(typeof authHeaders).toBe('function');
    expect(typeof fakeKv).toBe('function');
    expect(typeof fakeQueue).toBe('function');
    expect(typeof fakePaymentIntent).toBe('function');
    type LegacyDatabase = Database<{ marker: true }>;
    type LegacyBusinessDateAlias = BusinessDate;
    type LegacyTestDbAlias = TestDb;
    const sample: LegacyDatabase | LegacyBusinessDateAlias | LegacyTestDbAlias | undefined = undefined;
    expect(sample).toBeUndefined();
  });
});

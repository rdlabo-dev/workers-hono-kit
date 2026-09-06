import type {
  Database as DatabaseCanonical,
  DisposableDatabase as DisposableDatabaseCanonical,
  QueryRunner as QueryRunnerCanonical,
  TxOf as TxOfCanonical,
} from '@rdlabo/workers-mysql';
import { createTestDb as createTestDbCanonical } from '@rdlabo/workers-mysql/testing';
import type {
  CreateTestDbOptions as CreateTestDbOptionsCanonical,
  TestDb as TestDbCanonical,
  TestDbConnection as TestDbConnectionCanonical,
} from '@rdlabo/workers-mysql/testing';

/** @deprecated Import from `@rdlabo/workers-mysql/testing` instead. */
export const createTestDb: typeof createTestDbCanonical = createTestDbCanonical;

/** @deprecated Import from `@rdlabo/workers-mysql/testing` instead. */
export type TestDb = TestDbCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/testing` instead. */
export type CreateTestDbOptions = CreateTestDbOptionsCanonical;
/** @deprecated Import from `@rdlabo/workers-mysql/testing` instead. */
export type TestDbConnection = TestDbConnectionCanonical;

/** @deprecated Import from `@rdlabo/workers-mysql` or `@rdlabo/workers-mysql/testing` instead. */
export type TxOf<TDrizzle> = TxOfCanonical<TDrizzle>;
/** @deprecated Import from `@rdlabo/workers-mysql` or `@rdlabo/workers-mysql/testing` instead. */
export type Database<TDrizzle, TTx = TxOfCanonical<TDrizzle>> = DatabaseCanonical<TDrizzle, TTx>;
/** @deprecated Import from `@rdlabo/workers-mysql` or `@rdlabo/workers-mysql/testing` instead. */
export type DisposableDatabase<TDrizzle, TTx = TxOfCanonical<TDrizzle>> = DisposableDatabaseCanonical<TDrizzle, TTx>;
/** @deprecated Import from `@rdlabo/workers-mysql` or `@rdlabo/workers-mysql/testing` instead. */
export type QueryRunner = QueryRunnerCanonical;

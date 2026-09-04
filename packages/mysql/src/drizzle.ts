/** Drizzle adapters for `@rdlabo/workers-mysql`. Requires the optional `drizzle-orm` peer. */

export { jstTimestamp, jstDatetime, jstDate, jstOnUpdateNow } from './columns.js';
export { DRIZZLE_ORM_OPTIONS, workersDrizzleConfig, resolveDbSecret } from './orm-config.js';
// eslint-disable-next-line @typescript-eslint/no-deprecated -- public compatibility alias
export { honoDrizzleConfig } from './orm-config.js';
export type { WorkersDrizzleConfigOptions, ResolvedDbSecret } from './orm-config.js';
// eslint-disable-next-line @typescript-eslint/no-deprecated -- public compatibility alias
export type { HonoDrizzleConfigOptions } from './orm-config.js';

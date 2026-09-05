/**
 * @deprecated Install `@rdlabo/workers-mysql` and import its database infrastructure directly.
 * This compatibility subpath will be removed in the next major release.
 *
 * @packageDocumentation
 */

export * from '@rdlabo/workers-mysql';
export * from '@rdlabo/workers-mysql/drizzle';
export * from '@rdlabo/workers-mysql/migrations';

// Payment-domain SQL remains owned by workers-hono-kit rather than the generic MySQL package.
export { reopenGuardedPaymentFailedSet } from './payment-failed.js';

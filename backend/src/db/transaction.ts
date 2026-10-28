import type { Database } from 'better-sqlite3';

/** Runs a unit of work atomically: either every statement lands, or none does. */
export type TransactionRunner = <T>(work: () => T) => T;

/**
 * Wraps better-sqlite3's transaction helper behind a tiny function type.
 *
 * Services take a TransactionRunner rather than the database itself, so they
 * can guarantee atomicity without ever seeing a SQL driver - and a test could
 * pass a pass-through function if it wanted to.
 */
export function createTransactionRunner(db: Database): TransactionRunner {
  return <T>(work: () => T): T => db.transaction(work)();
}

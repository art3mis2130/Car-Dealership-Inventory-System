import type { Database } from 'better-sqlite3';
import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/http.js';

/**
 * Liveness and readiness in one endpoint.
 *
 * It actually queries the database rather than returning a hard-coded "ok":
 * a health check that cannot fail tells a load balancer nothing. If the
 * database is unreachable the process is alive but not ready to serve, which
 * is a 503.
 */
export class HealthController {
  constructor(private readonly db: Database) {}

  check = (_req: Request, res: Response): void => {
    const startedAt = process.hrtime.bigint();
    let database: 'connected' | 'unavailable' = 'connected';

    try {
      this.db.prepare('SELECT 1').get();
    } catch {
      database = 'unavailable';
    }

    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    const payload = {
      status: database === 'connected' ? ('ok' as const) : ('degraded' as const),
      database,
      databaseLatencyMs: Math.round(latencyMs * 1000) / 1000,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    sendSuccess(res, payload, database === 'connected' ? 200 : 503);
  };
}

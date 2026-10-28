import type { RequestHandler } from 'express';
import { getEnv } from '../config/env.js';

/**
 * One structured line per request, once the response has been sent.
 *
 * JSON rather than prose, because the first thing anyone does with logs in
 * production is parse them. Silent during tests, where it would be noise.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  if (getEnv().NODE_ENV === 'test') return next();

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    console.log(
      JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
        time: new Date().toISOString(),
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      }),
    );
  });

  next();
};

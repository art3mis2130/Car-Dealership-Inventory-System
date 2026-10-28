import type { ErrorRequestHandler, RequestHandler } from 'express';
import { getEnv } from '../config/env.js';
import { AppError, NotFoundError } from '../utils/errors.js';

/** Terminal 404 handler: anything that fell through the router. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
};

/**
 * The single place where an error becomes an HTTP response.
 *
 * Known AppErrors keep their status and message. Everything else is treated
 * as a bug: it is logged server-side and reported as a generic 500, so stack
 * traces and SQL never reach the client.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  // Every error body carries the request id, so a user can quote one string
  // in a bug report and it can be found in the logs.
  const requestId = req.id;

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
        requestId,
      },
    });
    return;
  }

  // body-parser raises these for a malformed or oversized payload.
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      success: false,
      error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON', requestId },
    });
    return;
  }

  if (isPayloadTooLarge(error)) {
    res.status(413).json({
      success: false,
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large', requestId },
    });
    return;
  }

  if (getEnv().NODE_ENV !== 'test') {
    console.error(JSON.stringify({ level: 'error', requestId, message: String(error) }));
  }

  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side', requestId },
  });
};

/** body-parser marks an oversized body with `type: 'entity.too.large'`. */
function isPayloadTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type?: unknown }).type === 'entity.too.large'
  );
}

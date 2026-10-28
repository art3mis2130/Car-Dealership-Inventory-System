import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/** A caller-supplied id is only trusted if it looks like a sane trace id. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Gives every request an id, echoes it back as `X-Request-Id`, and makes it
 * available to the error handler.
 *
 * An id supplied by the caller is honoured so a trace can span services, but
 * only after being checked: an unvalidated header would otherwise be reflected
 * straight back into a response, which is a header-injection foothold and an
 * easy way to poison logs.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const supplied = req.header('x-request-id');
  const id = supplied && SAFE_ID.test(supplied) ? supplied : randomUUID();

  req.id = id;
  res.setHeader('X-Request-Id', id);

  next();
};

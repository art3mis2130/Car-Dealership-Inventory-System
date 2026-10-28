import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps a route handler so a thrown error or a rejected promise reaches the
 * error middleware instead of leaving the request hanging.
 *
 * Express 4 catches neither on its own. Handlers may be sync or async: the
 * database driver is synchronous, so most controllers genuinely are too, and
 * this wrapper accepts both rather than forcing them to pretend otherwise.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return (req, res, next) => {
    try {
      const result = handler(req, res, next);

      if (result instanceof Promise) {
        result.catch(next);
      }
    } catch (error) {
      next(error);
    }
  };
}

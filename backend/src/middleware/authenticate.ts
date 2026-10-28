import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/token.js';
import type { Role } from '../types/index.js';

/**
 * Verifies the `Authorization: Bearer <jwt>` header and attaches the caller to
 * the request. Routes that need an identity mount this; nothing else in the
 * codebase parses the header.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');

  if (!header) {
    return next(new UnauthorizedError('Missing Authorization header'));
  }

  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return next(
      new UnauthorizedError('Expected an Authorization header of the form "Bearer <token>"'),
    );
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch (error) {
    return next(error);
  }
};

/**
 * Restricts a route to the given roles. Must be mounted after `authenticate`.
 *
 * Kept separate from authentication so "who are you" and "may you do this"
 * stay independent concerns - a route can require a login without caring
 * about the role, and the admin rule is declared once and reused.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`This action requires the ${roles.join(' or ')} role`));
    }

    return next();
  };
}

/** Convenience alias for the common case. */
export const requireAdmin = requireRole('ADMIN');

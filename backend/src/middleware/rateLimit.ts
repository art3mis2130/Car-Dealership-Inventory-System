import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/**
 * Throttles the credential endpoints.
 *
 * Only register and login are limited, not browsing: an attacker guessing
 * passwords makes many requests to one endpoint, while an ordinary user
 * browsing the lot makes many requests to all the others. Limiting everything
 * equally would punish the second to inconvenience the first.
 *
 * The 429 is rendered in the same error envelope as everything else, so a
 * client needs no special case for it.
 */
export function createAuthRateLimiter({
  windowMs,
  max,
}: RateLimitOptions): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Count only failures: a user who signs in successfully several times
    // (a shared office IP, say) should not be locked out.
    skipSuccessfulRequests: true,
    handler: (_req: Request, res: Response) => {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please wait a moment and try again.',
        },
      });
    },
  });
}

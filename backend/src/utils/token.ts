import jwt, { type SignOptions } from 'jsonwebtoken';
import { getEnv } from '../config/env.js';
import { UnauthorizedError } from './errors.js';
import type { Role } from '../types/index.js';

export interface AccessTokenPayload {
  /** Subject: the user id. */
  sub: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface TokenSubject {
  id: string;
  email: string;
  role: Role;
}

/** Signs a short-lived access token for a user. */
export function signAccessToken(user: TokenSubject, expiresIn?: string): string {
  const env = getEnv();
  const options = { expiresIn: expiresIn ?? env.JWT_EXPIRES_IN } as SignOptions;

  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.JWT_SECRET, options);
}

/**
 * Verifies a token's signature and expiry.
 *
 * Every failure mode becomes an UnauthorizedError so callers never have to
 * know about jsonwebtoken's error classes.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, getEnv().JWT_SECRET);

    if (typeof payload === 'string' || !payload.sub) {
      throw new UnauthorizedError('Malformed access token');
    }

    return payload as AccessTokenPayload;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;

    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token has expired');
    }

    throw new UnauthorizedError('Invalid access token');
  }
}

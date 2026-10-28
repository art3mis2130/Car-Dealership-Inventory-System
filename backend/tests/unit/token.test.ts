import { describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../../src/utils/token.js';
import { UnauthorizedError } from '../../src/utils/errors.js';

const user = { id: 'user-1', email: 'ada@example.com', role: 'ADMIN' as const };

describe('access tokens', () => {
  it('round-trips the user identity and role', () => {
    const payload = verifyAccessToken(signAccessToken(user));

    expect(payload.sub).toBe('user-1');
    expect(payload.email).toBe('ada@example.com');
    expect(payload.role).toBe('ADMIN');
  });

  it('rejects a token that was not signed by us', () => {
    const forged =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJoYWNrZXIiLCJyb2xlIjoiQURNSU4ifQ.bad';
    expect(() => verifyAccessToken(forged)).toThrow(UnauthorizedError);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyAccessToken('not-a-token')).toThrow(UnauthorizedError);
  });

  it('rejects an expired token', () => {
    const expired = signAccessToken(user, '-1s');
    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { createTestDatabase } from '../helpers/testDb.js';
import { UserRepository } from '../../src/repositories/userRepository.js';
import { AuthService } from '../../src/services/authService.js';
import { ConflictError, UnauthorizedError } from '../../src/utils/errors.js';
import { verifyAccessToken } from '../../src/utils/token.js';

describe('AuthService', () => {
  let db: Database;
  let cleanup: () => void;
  let service: AuthService;

  beforeEach(() => {
    ({ db, cleanup } = createTestDatabase());
    service = new AuthService(new UserRepository(db));
  });

  afterEach(() => cleanup());

  describe('register', () => {
    it('creates a user and returns a usable token', async () => {
      const result = await service.register({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        password: 'sup3r-secret',
      });

      expect(result.user.id).toBeTypeOf('string');
      expect(result.user.name).toBe('Ada Lovelace');
      expect(result.user.email).toBe('ada@example.com');
      expect(verifyAccessToken(result.token).sub).toBe(result.user.id);
    });

    it('defaults new accounts to the CUSTOMER role', async () => {
      const { user } = await service.register({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'sup3r-secret',
      });

      expect(user.role).toBe('CUSTOMER');
    });

    it('does not allow the caller to grant themselves ADMIN', async () => {
      const { user } = await service.register({
        name: 'Eve',
        email: 'eve@example.com',
        password: 'sup3r-secret',
        // A hostile client posting an extra field must not be able to escalate.
        role: 'ADMIN',
      } as never);

      expect(user.role).toBe('CUSTOMER');
    });

    it('never exposes the password hash', async () => {
      const { user } = await service.register({
        name: 'Ada',
        email: 'ada@example.com',
        password: 'sup3r-secret',
      });

      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password_hash');
    });

    it('stores the password as a hash, not plain text', async () => {
      await service.register({ name: 'Ada', email: 'ada@example.com', password: 'sup3r-secret' });

      const row = db
        .prepare<[string], { password_hash: string }>(
          'SELECT password_hash FROM users WHERE email = ?',
        )
        .get('ada@example.com');

      expect(row?.password_hash).toBeTypeOf('string');
      expect(row?.password_hash).not.toBe('sup3r-secret');
    });

    it('normalises the email so casing cannot create duplicates', async () => {
      const { user } = await service.register({
        name: 'Ada',
        email: '  Ada@Example.COM ',
        password: 'sup3r-secret',
      });

      expect(user.email).toBe('ada@example.com');
    });

    it('rejects an email that is already registered', async () => {
      await service.register({ name: 'Ada', email: 'ada@example.com', password: 'sup3r-secret' });

      await expect(
        service.register({ name: 'Imposter', email: 'ADA@example.com', password: 'other-pass' }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register({ name: 'Ada', email: 'ada@example.com', password: 'sup3r-secret' });
    });

    it('returns a token for valid credentials', async () => {
      const result = await service.login({ email: 'ada@example.com', password: 'sup3r-secret' });

      expect(result.user.email).toBe('ada@example.com');
      expect(verifyAccessToken(result.token).email).toBe('ada@example.com');
    });

    it('accepts a differently cased email', async () => {
      await expect(
        service.login({ email: 'ADA@EXAMPLE.com', password: 'sup3r-secret' }),
      ).resolves.toBeTruthy();
    });

    it('rejects a wrong password', async () => {
      await expect(
        service.login({ email: 'ada@example.com', password: 'wrong-pass' }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('rejects an unknown email with the same error as a wrong password', async () => {
      // Identical errors keep the endpoint from leaking which emails exist.
      await expect(
        service.login({ email: 'nobody@example.com', password: 'sup3r-secret' }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });
});

/**
 * Global Vitest setup. Runs before every test file.
 *
 * Tests must never touch the development database, so we force a test
 * environment and a deliberately weak (fast) bcrypt cost factor here.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_ROUNDS = '4';

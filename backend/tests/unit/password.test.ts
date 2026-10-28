import { describe, expect, it } from 'vitest';
import { comparePassword, hashPassword } from '../../src/utils/password.js';

describe('password hashing', () => {
  it('never returns the plain text password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('produces a different hash each time (salted)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('verifies a matching password', async () => {
    const hash = await hashPassword('s3cret-pass');
    await expect(comparePassword('s3cret-pass', hash)).resolves.toBe(true);
  });

  it('rejects a non-matching password', async () => {
    const hash = await hashPassword('s3cret-pass');
    await expect(comparePassword('wrong-pass', hash)).resolves.toBe(false);
  });
});

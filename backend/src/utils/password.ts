import bcrypt from 'bcryptjs';
import { getEnv } from '../config/env.js';

/** Hashes a plain text password with a per-password salt. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, getEnv().BCRYPT_ROUNDS);
}

/** Constant-time comparison of a candidate password against a stored hash. */
export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

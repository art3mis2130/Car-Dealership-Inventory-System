import { randomUUID } from 'node:crypto';
import type { UserRepository } from '../repositories/userRepository.js';
import type { PublicUser, Role } from '../types/index.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { signAccessToken } from '../utils/token.js';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

/**
 * Registration and login.
 *
 * Takes a repository rather than a database handle, so the service can be
 * tested (and later reused) without knowing how users are stored.
 */
export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = normaliseEmail(input.email);

    if (this.users.existsByEmail(email)) {
      throw new ConflictError('An account with that email already exists');
    }

    // Role is set here, never taken from the request body: a client cannot
    // promote itself to ADMIN by posting an extra field.
    const role: Role = 'CUSTOMER';

    const user = this.users.create({
      id: randomUUID(),
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(input.password),
      role,
    });

    return { user, token: signAccessToken(user) };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = normaliseEmail(input.email);
    const record = this.users.findByEmailWithCredentials(email);

    // Deliberately identical failures for "no such user" and "wrong password"
    // so the endpoint cannot be used to enumerate registered emails.
    const invalid = new UnauthorizedError('Invalid email or password');

    if (!record) throw invalid;
    if (!(await comparePassword(input.password, record.passwordHash))) throw invalid;

    const { passwordHash: _ignored, ...user } = record;

    return { user, token: signAccessToken(user) };
  }
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

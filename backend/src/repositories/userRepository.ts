import type { Database } from 'better-sqlite3';
import type { PublicUser, Role, UserWithCredentials } from '../types/index.js';

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  created_at: string;
}

export interface CreateUserInput {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

/**
 * All SQL for the users table lives here.
 *
 * Services depend on this class rather than on `better-sqlite3` directly, so
 * swapping SQLite for Postgres would mean rewriting this file and nothing else.
 */
export class UserRepository {
  constructor(private readonly db: Database) {}

  create(input: CreateUserInput): PublicUser {
    this.db
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, role)
         VALUES (@id, @name, @email, @passwordHash, @role)`,
      )
      .run(input);

    // Read back so defaults filled in by the database (created_at) are returned.
    const created = this.findById(input.id);
    if (!created) {
      throw new Error(`User ${input.id} vanished immediately after insert`);
    }

    return created;
  }

  findById(id: string): PublicUser | null {
    const row = this.db.prepare<[string], UserRow>('SELECT * FROM users WHERE id = ?').get(id);

    return row ? toPublicUser(row) : null;
  }

  /** Looks a user up for credential checking. Expects an already-normalised email. */
  findByEmailWithCredentials(email: string): UserWithCredentials | null {
    const row = this.db
      .prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?')
      .get(email);

    return row ? { ...toPublicUser(row), passwordHash: row.password_hash } : null;
  }

  existsByEmail(email: string): boolean {
    const row = this.db
      .prepare<[string], { count: number }>('SELECT COUNT(*) AS count FROM users WHERE email = ?')
      .get(email);

    return (row?.count ?? 0) > 0;
  }

  countAll(): number {
    const row = this.db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM users').get();

    return row?.count ?? 0;
  }
}

/** Maps a snake_case database row onto the camelCase domain object. */
function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

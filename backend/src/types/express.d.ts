import type { Role } from './index.js';

/** The caller identity that `authenticate` attaches to the request. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      /** Present only on routes behind the `authenticate` middleware. */
      user?: AuthenticatedUser;
      /** Correlation id, set for every request by the requestId middleware. */
      id?: string;
    }
  }
}

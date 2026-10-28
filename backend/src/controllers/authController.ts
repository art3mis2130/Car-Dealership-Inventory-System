import type { Request, Response } from 'express';
import type { AuthService } from '../services/authService.js';
import type { UserRepository } from '../repositories/userRepository.js';
import { loginSchema, registerSchema } from '../validation/authSchemas.js';
import { parseOrThrow, sendSuccess } from '../utils/http.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * HTTP adapter for authentication.
 *
 * Controllers only translate: parse and validate input, call a service, shape
 * the response. No business rules live here, which is what keeps the service
 * layer reusable and independently testable.
 */
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly users: UserRepository,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const body = parseOrThrow(registerSchema, req.body);
    const result = await this.authService.register(body);

    sendSuccess(res, result, 201);
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const body = parseOrThrow(loginSchema, req.body);
    const result = await this.authService.login(body);

    sendSuccess(res, result);
  };

  /** Lets the frontend restore a session from a stored token on page load. */
  me = (req: Request, res: Response): void => {
    const user = req.user ? this.users.findById(req.user.id) : null;

    if (!user) {
      throw new UnauthorizedError('This account no longer exists');
    }

    sendSuccess(res, { user });
  };
}

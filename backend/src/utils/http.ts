import type { Response } from 'express';
import type { ZodError, ZodTypeAny, output } from 'zod';
import { ValidationError } from './errors.js';

/**
 * Every successful response has the same shape:
 *   { "success": true, "data": <payload>, "meta": <optional> }
 *
 * and every failure:
 *   { "success": false, "error": { "code", "message", "details"? } }
 *
 * One envelope means the frontend needs exactly one response handler.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: Record<string, unknown>,
): void {
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}) });
}

/**
 * Validates untrusted input against a schema, raising a ValidationError that
 * the error middleware renders as a 422 with a field-by-field breakdown.
 *
 * Parsing at the edge of the application is what lets services below assume
 * their inputs are already well-formed.
 *
 * The generic is the schema, not its payload: several schemas transform their
 * input (a lower-case category becomes an enum member, a "true" string
 * becomes a boolean), and inferring from the schema is what makes the caller
 * see the parsed output type rather than the raw request type.
 */
export function parseOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): output<S> {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ValidationError('Validation failed', formatZodIssues(result.error));
  }

  return result.data as output<S>;
}

function formatZodIssues(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

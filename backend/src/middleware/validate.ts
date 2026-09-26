import type { NextFunction, Request, Response } from 'express';
import type { AnyZodObject } from 'zod';
import { wrapZodError } from '../utils/http';
import { AppError, errorCodes } from '../utils/errors';

export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (!result.success) {
        const issues = result.error.issues[0];
        throw new AppError(
          422,
          issues ? `${issues.path.join('.')}: ${issues.message}` : 'Invalid request',
          errorCodes.VALIDATION_ERROR,
          result.error.flatten(),
        );
      }
      const data = result.data as { body?: unknown; query?: unknown; params?: unknown };
      if (data.body !== undefined) req.body = data.body;
      if (data.query !== undefined) req.query = data.query as Request['query'];
      if (data.params !== undefined) req.params = data.params as Request['params'];
      next();
    } catch (err) {
      next(wrapZodError(err));
    }
  };
}

/** Read the body after `validate()` has replaced it with parsed data. */
export function body<T>(req: Request): T {
  return req.body as T;
}

/** Read the query after `validate()` has replaced it with parsed data. */
export function query<T>(req: Request): T {
  return req.query as unknown as T;
}

/** Read the params after `validate()` has replaced it with parsed data. */
export function params<T>(req: Request): T {
  return req.params as T;
}

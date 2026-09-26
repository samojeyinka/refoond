import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError, errorCodes } from './errors';

export function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  NextFunction: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      details: err.details,
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Something went wrong';
  console.error('[error]', err);

  res.status(500).json({
    success: false,
    message: 'Something went wrong',
    code: errorCodes.INTERNAL,
    ...(process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'
      ? { details: message }
      : {}),
  });
}

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function wrapZodError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error && 'issues' in error) {
    const issues = (error as { issues: { message: string; path: (string | number)[] }[] }).issues;
    return new AppError(422, issues[0]?.message ?? 'Invalid request', errorCodes.VALIDATION_ERROR, issues);
  }
  return new AppError(500, 'Something went wrong', errorCodes.INTERNAL);
}
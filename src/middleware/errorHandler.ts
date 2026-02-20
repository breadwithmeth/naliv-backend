import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let { statusCode = 500, message } = error;

  const isProd = process.env.NODE_ENV === 'production';
  const isServerError = statusCode >= 500;

  // Логирование ошибки
  console.error(`Error ${statusCode}: ${message}`);
  console.error(error.stack);

  // В production не показываем детали внутренних ошибок
  const publicMessage = (isProd && isServerError) ? 'Internal Server Error' : message;

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      message: publicMessage,
      statusCode,
      timestamp: new Date().toISOString()
    }
  });
};

// Создание кастомной ошибки
export const createError = (statusCode: number, message: string): ApiError => {
  const error: ApiError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};

import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { createError } from './errorHandler';

export const validateRequest = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const message = error.details.map((d) => d.message).join('; ');
      return next(createError(400, message));
    }

    req.body = value;
    next();
  };
};

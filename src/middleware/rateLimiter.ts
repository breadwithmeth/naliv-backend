import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const phoneOrIpKey = (req: Request): string => {
  const phone = (req.body?.phone as string) || (req.body?.phone_number as string);
  return phone || req.ip || 'unknown';
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: phoneOrIpKey,
  message: 'Слишком много попыток. Попробуйте позже.'
});

export const sendCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: phoneOrIpKey,
  message: 'Слишком много попыток отправки кода. Попробуйте позже.'
});

export const paymentsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  message: 'Слишком много платежных запросов. Попробуйте позже.'
});

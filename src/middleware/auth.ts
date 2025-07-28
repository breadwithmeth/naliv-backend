import { Response, NextFunction } from 'express';
import { AuthController, AuthRequest } from '../controllers/authController';
import { createError } from './errorHandler';
import prisma from '../database';

/**
 * Middleware для проверки JWT токена и аутентификации пользователя
 */
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      throw createError(401, 'Токен доступа не предоставлен');
    }

    // Проверяем валидность токена
    const decoded = AuthController.verifyToken(token);

    // Проверяем, существует ли пользователь
    const user = await prisma.user.findUnique({
      where: { user_id: decoded.user_id }
    });

    if (!user) {
      throw createError(401, 'Пользователь не найден');
    }

    // Добавляем информацию о пользователе в запрос
    req.user = {
      user_id: decoded.user_id,
      login: decoded.login,
      name: user.name || undefined
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware для опциональной аутентификации (не обязательной)
 */
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      // Если токена нет, продолжаем без аутентификации
      return next();
    }

    try {
      // Проверяем валидность токена
      const decoded = AuthController.verifyToken(token);

      // Проверяем, существует ли пользователь
      const user = await prisma.user.findUnique({
        where: { user_id: decoded.user_id }
      });

      if (user) {
        // Проверяем, существует ли пользователь
        const user = await prisma.user.findUnique({
          where: { user_id: decoded.user_id }
        });

        if (user) {
          // Добавляем информацию о пользователе в запрос
          req.user = {
            user_id: decoded.user_id,
            login: decoded.login,
            name: user.name || undefined
          };
        }
      }
    } catch (error) {
      // Игнорируем ошибки токена в опциональной аутентификации
    }

    next();
  } catch (error) {
    next(error);
  }
};

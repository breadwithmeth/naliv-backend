import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';
import prisma from '../database';
import { CourierAuthController } from '../controllers/courierAuthController';

export interface CourierAuthRequest extends Request {
  courier?: {
    courier_id: number;
    login: string;
    courier_type: number;
  };
}

/**
 * Middleware аутентификации курьера
 */
export const authenticateCourier = async (req: CourierAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError(401, 'Токен авторизации не предоставлен'));
    }

    const token = authHeader.split(' ')[1];
    const decoded = CourierAuthController.verifyToken(token);

    // Проверяем наличие токена в БД
    const tokenRecord = await prisma.courier_token.findFirst({
      where: { token, courier_id: decoded.courier_id }
    });
    if (!tokenRecord) {
      return next(createError(401, 'Недействительный токен'));
    }

    // Получаем курьера
    const courier = await prisma.couriers.findUnique({
      where: { courier_id: decoded.courier_id },
      select: { courier_id: true, login: true, courier_type: true }
    });
    if (!courier) {
      return next(createError(401, 'Курьер не найден'));
    }

    req.courier = {
      courier_id: courier.courier_id,
      login: courier.login || '',
      courier_type: courier.courier_type
    };

    next();
  } catch (error: any) {
    console.error('Ошибка аутентификации курьера:', error);
    if (error.name === 'JsonWebTokenError') {
      return next(createError(401, 'Недействительный токен'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(createError(401, 'Токен истек'));
    }
    next(createError(500, 'Ошибка аутентификации курьера'));
  }
};

/**
 * Опциональная аутентификация курьера
 */
export const optionalCourierAuth = async (req: CourierAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = CourierAuthController.verifyToken(token);

    const tokenRecord = await prisma.courier_token.findFirst({
      where: { token, courier_id: decoded.courier_id }
    });
    if (!tokenRecord) {
      return next();
    }

    const courier = await prisma.couriers.findUnique({
      where: { courier_id: decoded.courier_id },
      select: { courier_id: true, login: true, courier_type: true }
    });
    if (courier) {
      req.courier = {
        courier_id: courier.courier_id,
        login: courier.login || '',
        courier_type: courier.courier_type
      };
    }
    next();
  } catch (error) {
    next();
  }
};

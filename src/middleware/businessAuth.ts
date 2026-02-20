import { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';
import prisma from '../database';

// Интерфейс для расширения Request с информацией о бизнесе
export interface BusinessAuthRequest extends Request {
  business?: {
    business_id: number;
    name: string;
    organization_id: number;
    uuid: string;
    enabled: number;
  };
}

/**
 * Middleware для авторизации бизнеса по токену из таблицы businesses
 * Проверяет токен в поле token таблицы businesses
 */
export const authenticateBusinessToken = async (
  req: BusinessAuthRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : null;

    if (!token) {
      throw createError(401, 'Токен доступа бизнеса не предоставлен');
    }

    // Ищем бизнес по токену
    const business = await prisma.businesses.findFirst({
      where: { 
        token: token,
        enabled: 1 // Проверяем, что бизнес активен
      },
      select: {
        business_id: true,
        name: true,
        organization_id: true,
        uuid: true,
        enabled: true
      }
    });

    if (!business) {
      throw createError(401, 'Недействительный токен бизнеса или бизнес отключен');
    }

    // Добавляем информацию о бизнесе в запрос
    req.business = {
      business_id: business.business_id,
      name: business.name,
      organization_id: business.organization_id,
      uuid: business.uuid,
      enabled: business.enabled
    };
next();
  } catch (error) {
    next(error);
  }
};

/**
 * Основной middleware для авторизации бизнеса (алиас для authenticateBusinessToken)
 * Проверяет токен только в поле token таблицы businesses
 */
export const authenticateBusiness = authenticateBusinessToken;

/**
 * Middleware для опциональной авторизации бизнеса
 * Не требует токен, но если он предоставлен, то проверяет его в businesses.token
 */
export const optionalBusinessAuth = async (
  req: BusinessAuthRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : null;

    if (!token) {
      // Если токен не предоставлен, просто продолжаем без авторизации
      next();
      return;
    }

    // Если токен предоставлен, проверяем его в таблице businesses
    const business = await prisma.businesses.findFirst({
      where: { 
        token: token,
        enabled: 1
      },
      select: {
        business_id: true,
        name: true,
        organization_id: true,
        uuid: true,
        enabled: true
      }
    });

    if (business) {
      req.business = {
        business_id: business.business_id,
        name: business.name,
        organization_id: business.organization_id,
        uuid: business.uuid,
        enabled: business.enabled
      };
}

    next();
  } catch (error) {
    // При опциональной авторизации не прерываем выполнение при ошибках
    console.warn('Ошибка опциональной авторизации бизнеса:', error);
    next();
  }
};

/**
 * Middleware для проверки, что бизнес имеет доступ к определенному ресурсу
 * Используется после authenticateBusiness
 */
export const requireBusinessAccess = (resourceBusinessIdField: string = 'business_id') => {
  return (req: BusinessAuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.business) {
        throw createError(401, 'Требуется авторизация бизнеса');
      }

      const resourceBusinessId = req.params[resourceBusinessIdField] || req.body[resourceBusinessIdField];
      
      if (resourceBusinessId && parseInt(resourceBusinessId) !== req.business.business_id) {
        throw createError(403, 'Доступ запрещен: недостаточно прав для данного бизнеса');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Экспортируем основной middleware как default
export default authenticateBusiness;
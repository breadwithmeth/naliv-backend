import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from './errorHandler';
import { EmployeeAuthController } from '../controllers/employeeAuthController';

interface EmployeeAuthRequest extends Request {
  employee?: {
    employee_id: number;
    login: string;
    access_level: string;
  };
}

/**
 * Middleware для аутентификации сотрудников
 * Проверяет JWT токен и добавляет информацию о сотруднике в req.employee
 */
export const authenticateEmployee = async (req: EmployeeAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError(401, 'Токен авторизации не предоставлен'));
    }

    const token = authHeader.split(' ')[1];

    // Верифицируем JWT токен
    const decoded = EmployeeAuthController.verifyToken(token);

    // Проверяем, существует ли токен в базе данных
    const tokenRecord = await prisma.employee_tokens.findFirst({
      where: { 
        token,
        employee_id: decoded.employee_id
      }
    });

    if (!tokenRecord) {
      return next(createError(401, 'Недействительный токен'));
    }

    // Проверяем, существует ли сотрудник
    const employee = await prisma.employee.findUnique({
      where: { employee_id: decoded.employee_id },
      select: {
        employee_id: true,
        login: true,
        name: true,
        access_level: true
      }
    });

    if (!employee) {
      return next(createError(401, 'Сотрудник не найден'));
    }

    // Добавляем информацию о сотруднике в запрос
    req.employee = {
      employee_id: employee.employee_id,
      login: employee.login,
      access_level: employee.access_level || 'OPERATOR'
    };

    next();

  } catch (error: any) {
    console.error('Ошибка аутентификации сотрудника:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return next(createError(401, 'Недействительный токен'));
    }
    
    if (error.name === 'TokenExpiredError') {
      return next(createError(401, 'Токен истек'));
    }

    next(createError(500, 'Ошибка аутентификации'));
  }
};

/**
 * Middleware для проверки уровня доступа сотрудника
 */
export const requireAccessLevel = (minLevel: 'OPERATOR' | 'MANAGER' | 'ADMIN') => {
  const accessLevels = {
    'OPERATOR': 1,
    'MANAGER': 2,
    'ADMIN': 3
  };

  return (req: EmployeeAuthRequest, res: Response, next: NextFunction) => {
    if (!req.employee) {
      return next(createError(401, 'Сотрудник не авторизован'));
    }

    const employeeLevel = accessLevels[req.employee.access_level as keyof typeof accessLevels] || 1;
    const requiredLevel = accessLevels[minLevel];

    if (employeeLevel < requiredLevel) {
      return next(createError(403, 'Недостаточно прав доступа'));
    }

    next();
  };
};

/**
 * Опциональная аутентификация сотрудника
 * Не возвращает ошибку, если токен отсутствует, но проверяет его если он есть
 */
export const optionalEmployeeAuth = async (req: EmployeeAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Продолжаем без аутентификации
    }

    const token = authHeader.split(' ')[1];

    // Верифицируем JWT токен
    const decoded = EmployeeAuthController.verifyToken(token);

    // Проверяем, существует ли токен в базе данных
    const tokenRecord = await prisma.employee_tokens.findFirst({
      where: { 
        token,
        employee_id: decoded.employee_id
      }
    });

    if (!tokenRecord) {
      return next(); // Продолжаем без аутентификации
    }

    // Проверяем, существует ли сотрудник
    const employee = await prisma.employee.findUnique({
      where: { employee_id: decoded.employee_id },
      select: {
        employee_id: true,
        login: true,
        name: true,
        access_level: true
      }
    });

    if (employee) {
      // Добавляем информацию о сотруднике в запрос
      req.employee = {
        employee_id: employee.employee_id,
        login: employee.login,
        access_level: employee.access_level || 'OPERATOR'
      };
    }

    next();

  } catch (error: any) {
    // При опциональной аутентификации просто продолжаем без ошибки
    next();
  }
};

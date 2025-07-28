import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../database';
import { EmployeeAuthController } from '../controllers/employeeAuthController';

interface OptionalAuthRequest extends Request {
  user?: {
    user_id: number;
    login: string;
  };
  employee?: {
    employee_id: number;
    login: string;
    access_level: string;
  };
}

/**
 * Middleware для опциональной аутентификации пользователей и сотрудников
 * Проверяет токен, если он предоставлен, но не возвращает ошибку если токена нет
 */
export const optionalAuth = async (req: OptionalAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Продолжаем без аутентификации
    }

    const token = authHeader.split(' ')[1];

    try {
      // Сначала пробуем как пользовательский токен
      const userDecoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      
      if (userDecoded.user_id) {
        // Это пользовательский токен
        const user = await prisma.user.findUnique({
          where: { user_id: userDecoded.user_id },
          select: {
            user_id: true,
            login: true
          }
        });

        if (user) {
          req.user = {
            user_id: user.user_id,
            login: user.login || ''
          };
          return next();
        }
      }
    } catch (userError) {
      // Пробуем как токен сотрудника
      try {
        const employeeDecoded = EmployeeAuthController.verifyToken(token);
        
        // Проверяем, существует ли токен сотрудника в базе данных
        const tokenRecord = await prisma.employee_tokens.findFirst({
          where: { 
            token,
            employee_id: employeeDecoded.employee_id
          }
        });

        if (tokenRecord) {
          // Проверяем, существует ли сотрудник
          const employee = await prisma.employee.findUnique({
            where: { employee_id: employeeDecoded.employee_id },
            select: {
              employee_id: true,
              login: true,
              name: true,
              access_level: true
            }
          });

          if (employee) {
            req.employee = {
              employee_id: employee.employee_id,
              login: employee.login,
              access_level: employee.access_level || 'OPERATOR'
            };
            return next();
          }
        }
      } catch (employeeError) {
        // Если оба токена недействительны, просто продолжаем без аутентификации
      }
    }

    next(); // Продолжаем без аутентификации

  } catch (error: any) {
    // При опциональной аутентификации просто продолжаем без ошибки
    next();
  }
};

export default optionalAuth;

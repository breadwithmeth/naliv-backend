import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

// Интерфейсы для типизации
interface EmployeeAuthRequest extends Request {
  employee?: {
    employee_id: number;
    login: string;
    access_level: string;
  };
}

interface EmployeeJWTPayload {
  employee_id: number;
  login: string;
  access_level: string;
  iat?: number;
  exp?: number;
}

interface EmployeeLoginRequest {
  login: string;
  password: string;
}

interface EmployeeRegisterRequest {
  login: string;
  password: string;
  name?: string;
  access_level?: 'OPERATOR' | 'MANAGER' | 'ADMIN';
}

export class EmployeeAuthController {

  /**
   * Регистрация нового сотрудника
   * POST /api/employee/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { login, password, name, access_level = 'OPERATOR' }: EmployeeRegisterRequest = req.body;

      // Валидация данных
      if (!login || !password) {
        return next(createError(400, 'Логин и пароль обязательны'));
      }

      if (password.length < 6) {
        return next(createError(400, 'Пароль должен содержать минимум 6 символов'));
      }

      // Проверяем, не существует ли уже сотрудник с таким логином
      const existingEmployee = await prisma.employee.findFirst({
        where: { login }
      });

      if (existingEmployee) {
        return next(createError(409, 'Сотрудник с таким логином уже существует'));
      }

      // Хешируем пароль
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Создаем сотрудника
      const employee = await prisma.employee.create({
        data: {
          login,
          password: hashedPassword,
          name,
          access_level
        }
      });

      // Генерируем JWT токен
      const token = EmployeeAuthController.generateToken({
        employee_id: employee.employee_id,
        login: employee.login,
        access_level: employee.access_level || 'OPERATOR'
      });

      // Сохраняем токен в базе данных
      await prisma.employee_tokens.create({
        data: {
          token,
          employee_id: employee.employee_id,
          log_timestamp: new Date()
        }
      });

      // Убираем пароль из ответа
      const { password: _, ...employeeWithoutPassword } = employee;

      res.status(201).json({
        success: true,
        data: {
          employee: employeeWithoutPassword,
          token
        },
        message: 'Сотрудник успешно зарегистрирован'
      });

    } catch (error: any) {
      console.error('Ошибка регистрации сотрудника:', error);
      next(createError(500, `Ошибка регистрации: ${error.message}`));
    }
  }

  /**
   * Вход сотрудника в систему
   * POST /api/employee/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { login, password }: EmployeeLoginRequest = req.body;

      // Валидация данных
      if (!login || !password) {
        return next(createError(400, 'Логин и пароль обязательны'));
      }

      // Ищем сотрудника по логину
      const employee = await prisma.employee.findFirst({
        where: { login }
      });

      if (!employee) {
        return next(createError(401, 'Неверный логин или пароль'));
      }

      // Проверяем пароль
      const isPasswordValid = await bcrypt.compare(password, employee.password);
      if (!isPasswordValid) {
        return next(createError(401, 'Неверный логин или пароль'));
      }

      // Генерируем JWT токен
      const token = EmployeeAuthController.generateToken({
        employee_id: employee.employee_id,
        login: employee.login,
        access_level: employee.access_level || 'OPERATOR'
      });

      // Сохраняем токен в базе данных
      await prisma.employee_tokens.create({
        data: {
          token,
          employee_id: employee.employee_id,
          log_timestamp: new Date()
        }
      });

      // Убираем пароль из ответа
      const { password: _, ...employeeWithoutPassword } = employee;

      res.json({
        success: true,
        data: {
          employee: employeeWithoutPassword,
          token
        },
        message: 'Авторизация успешна'
      });

    } catch (error: any) {
      console.error('Ошибка входа сотрудника:', error);
      next(createError(500, `Ошибка авторизации: ${error.message}`));
    }
  }

  /**
   * Выход сотрудника из системы
   * POST /api/employee/auth/logout
   */
  static async logout(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(createError(400, 'Токен не предоставлен'));
      }

      // Удаляем токен из базы данных
      await prisma.employee_tokens.deleteMany({
        where: { token }
      });

      res.json({
        success: true,
        message: 'Выход выполнен успешно'
      });

    } catch (error: any) {
      console.error('Ошибка выхода сотрудника:', error);
      next(createError(500, `Ошибка выхода: ${error.message}`));
    }
  }

  /**
   * Получение профиля сотрудника
   * GET /api/employee/auth/profile
   */
  static async getProfile(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.employee) {
        return next(createError(401, 'Сотрудник не авторизован'));
      }

      // Получаем актуальную информацию о сотруднике
      const employee = await prisma.employee.findUnique({
        where: { employee_id: req.employee.employee_id },
        select: {
          employee_id: true,
          login: true,
          name: true,
          access_level: true
        }
      });

      if (!employee) {
        return next(createError(404, 'Сотрудник не найден'));
      }

      res.json({
        success: true,
        data: { employee }
      });

    } catch (error: any) {
      console.error('Ошибка получения профиля сотрудника:', error);
      next(createError(500, `Ошибка получения профиля: ${error.message}`));
    }
  }

  /**
   * Смена пароля сотрудника
   * PUT /api/employee/auth/change-password
   */
  static async changePassword(req: EmployeeAuthRequest, res: Response, next: NextFunction) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!req.employee) {
        return next(createError(401, 'Сотрудник не авторизован'));
      }

      // Валидация данных
      if (!currentPassword || !newPassword) {
        return next(createError(400, 'Текущий пароль и новый пароль обязательны'));
      }

      if (newPassword.length < 6) {
        return next(createError(400, 'Новый пароль должен содержать минимум 6 символов'));
      }

      // Получаем сотрудника
      const employee = await prisma.employee.findUnique({
        where: { employee_id: req.employee.employee_id }
      });

      if (!employee) {
        return next(createError(404, 'Сотрудник не найден'));
      }

      // Проверяем текущий пароль
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, employee.password);
      if (!isCurrentPasswordValid) {
        return next(createError(401, 'Неверный текущий пароль'));
      }

      // Хешируем новый пароль
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Обновляем пароль
      await prisma.employee.update({
        where: { employee_id: req.employee.employee_id },
        data: { password: hashedNewPassword }
      });

      res.json({
        success: true,
        message: 'Пароль успешно изменен'
      });

    } catch (error: any) {
      console.error('Ошибка смены пароля сотрудника:', error);
      next(createError(500, `Ошибка смены пароля: ${error.message}`));
    }
  }

  /**
   * Генерация JWT токена
   */
  private static generateToken(payload: Omit<EmployeeJWTPayload, 'iat' | 'exp'>): string {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    if (!secret) {
      throw new Error('JWT_SECRET не установлен в переменных окружения');
    }

    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  /**
   * Верификация JWT токена
   */
  static verifyToken(token: string): EmployeeJWTPayload {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET не установлен в переменных окружения');
    }

    return jwt.verify(token, secret) as EmployeeJWTPayload;
  }
}

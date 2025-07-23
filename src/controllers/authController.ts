import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

// Интерфейсы для типизации
interface AuthRequest extends Request {
  user?: {
    user_id: number;
    login: string;
    name?: string;
  };
}

interface JWTPayload {
  user_id: number;
  login: string;
  iat?: number;
  exp?: number;
}

export class AuthController {
  
  /**
   * Регистрация нового пользователя по номеру телефона
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, name, first_name, last_name, password } = req.body;

      if (!phone || !password) {
        throw createError(400, 'Номер телефона и пароль обязательны');
      }

      // Валидация формата номера телефона (+77077707600)
      const phoneRegex = /^\+7\d{10}$/;
      if (!phoneRegex.test(phone)) {
        throw createError(400, 'Неверный формат номера телефона. Используйте формат +77077707600');
      }

      // Проверяем, не существует ли уже пользователь с таким номером
      const existingUser = await prisma.user.findFirst({
        where: { login: phone }
      });

      if (existingUser) {
        throw createError(409, 'Пользователь с таким номером телефона уже существует');
      }

      // Хешируем пароль
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Создаем пользователя
      const newUser = await prisma.user.create({
        data: {
          login: phone,
          password: hashedPassword,
          name: name || `${first_name || ''} ${last_name || ''}`.trim() || null,
          first_name: first_name || null,
          last_name: last_name || null
        }
      });

      // Генерируем JWT токен
      const token = AuthController.generateToken({
        user_id: newUser.user_id,
        login: newUser.login!
      });

      // Сохраняем токен в базе данных
      await prisma.users_tokens.create({
        data: {
          user_id: newUser.user_id,
          token: token
        }
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: newUser.user_id,
            phone: newUser.login,
            name: newUser.name,
            first_name: newUser.first_name,
            last_name: newUser.last_name,
            created_at: newUser.log_timestamp
          },
          token: token
        },
        message: 'Пользователь успешно зарегистрирован'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Авторизация пользователя по номеру телефона и паролю
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, password } = req.body;

      if (!phone || !password) {
        throw createError(400, 'Номер телефона и пароль обязательны');
      }

      // Валидация формата номера телефона
      const phoneRegex = /^\+7\d{10}$/;
      if (!phoneRegex.test(phone)) {
        throw createError(400, 'Неверный формат номера телефона. Используйте формат +77077707600');
      }

      // Ищем пользователя по номеру телефона
      const user = await prisma.user.findFirst({
        where: { login: phone }
      });

      if (!user || !user.password) {
        throw createError(401, 'Неверный номер телефона или пароль');
      }

      // Проверяем пароль
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw createError(401, 'Неверный номер телефона или пароль');
      }

      // Генерируем новый JWT токен
      const token = AuthController.generateToken({
        user_id: user.user_id,
        login: user.login!
      });

      // Сохраняем токен в базе данных
      await prisma.users_tokens.create({
        data: {
          user_id: user.user_id,
          token: token
        }
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.user_id,
            phone: user.login,
            name: user.name,
            first_name: user.first_name,
            last_name: user.last_name,
            created_at: user.log_timestamp
          },
          token: token
        },
        message: 'Авторизация успешна'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Выход из системы (деактивация токена)
   */
  static async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        throw createError(400, 'Токен не предоставлен');
      }

      // Удаляем токен из базы данных
      await prisma.users_tokens.deleteMany({
        where: { token: token }
      });

      res.json({
        success: true,
        message: 'Выход из системы выполнен успешно'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получить информацию о текущем пользователе
   */
  static async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError(401, 'Пользователь не авторизован');
      }

      const user = await prisma.user.findUnique({
        where: { user_id: req.user.user_id }
      });

      if (!user) {
        throw createError(404, 'Пользователь не найден');
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.user_id,
            phone: user.login,
            name: user.name,
            first_name: user.first_name,
            last_name: user.last_name,
            date_of_birth: user.date_of_birth,
            sex: user.sex,
            created_at: user.log_timestamp
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Обновить профиль пользователя
   */
  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError(401, 'Пользователь не авторизован');
      }

      const { name, first_name, last_name, date_of_birth, sex } = req.body;
      const userId = req.user.user_id;

      const updatedUser = await prisma.user.update({
        where: { user_id: userId },
        data: {
          ...(name && { name }),
          ...(first_name && { first_name }),
          ...(last_name && { last_name }),
          ...(date_of_birth && { date_of_birth: new Date(date_of_birth) }),
          ...(sex !== undefined && { sex })
        }
      });

      res.json({
        success: true,
        data: {
          user: {
            id: updatedUser.user_id,
            phone: updatedUser.login,
            name: updatedUser.name,
            first_name: updatedUser.first_name,
            last_name: updatedUser.last_name,
            date_of_birth: updatedUser.date_of_birth,
            sex: updatedUser.sex,
            created_at: updatedUser.log_timestamp
          }
        },
        message: 'Профиль успешно обновлен'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Смена пароля
   */
  static async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createError(401, 'Пользователь не авторизован');
      }

      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        throw createError(400, 'Текущий и новый пароль обязательны');
      }

      if (new_password.length < 6) {
        throw createError(400, 'Новый пароль должен содержать минимум 6 символов');
      }

      // Получаем пользователя с паролем
      const user = await prisma.user.findUnique({
        where: { user_id: req.user.user_id }
      });

      if (!user || !user.password) {
        throw createError(404, 'Пользователь не найден');
      }

      // Проверяем текущий пароль
      const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password);
      if (!isCurrentPasswordValid) {
        throw createError(401, 'Неверный текущий пароль');
      }

      // Хешируем новый пароль
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(new_password, saltRounds);

      // Обновляем пароль
      await prisma.user.update({
        where: { user_id: req.user.user_id },
        data: { password: hashedNewPassword }
      });

      // Удаляем все токены пользователя (принудительный выход)
      await prisma.users_tokens.deleteMany({
        where: { user_id: req.user.user_id }
      });

      res.json({
        success: true,
        message: 'Пароль успешно изменен. Выполните повторную авторизацию'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Генерация JWT токена
   */
  private static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
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
  static verifyToken(token: string): JWTPayload {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error('JWT_SECRET не установлен в переменных окружения');
    }

    try {
      return jwt.verify(token, secret) as JWTPayload;
    } catch (error) {
      throw createError(401, 'Недействительный токен');
    }
  }
}

export { AuthRequest };

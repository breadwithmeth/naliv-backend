import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

interface CourierAuthRequest extends Request {
  courier?: {
    courier_id: number;
    login: string;
    courier_type: number;
  };
}

interface CourierJWTPayload {
  courier_id: number;
  login: string;
  courier_type: number;
  iat?: number;
  exp?: number;
}

interface CourierLoginRequest {
  login: string;
  password: string;
}

interface CourierRegisterRequest {
  login: string;
  password: string;
  name?: string;
  full_name?: string;
  courier_type?: number; // 1 по умолчанию
}

export class CourierAuthController {
  /**
   * Регистрация курьера
   * POST /api/courier/auth/register
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { login, password, name, full_name, courier_type = 1 }: CourierRegisterRequest = req.body;

      const normalizedLogin = login?.trim();
      const rawPassword = password?.trim();

      if (!normalizedLogin || !rawPassword) {
        return next(createError(400, 'Логин и пароль обязательны'));
      }
      if (rawPassword.length < 6) {
        return next(createError(400, 'Пароль должен содержать минимум 6 символов'));
      }
      if (!/[0-9]/.test(rawPassword) || !/[A-Za-zА-Яа-я]/.test(rawPassword)) {
        return next(createError(400, 'Пароль должен содержать буквы и цифры'));
      }

      const existing = await prisma.couriers.findFirst({ where: { login: normalizedLogin } });
      if (existing) {
        return next(createError(409, 'Курьер с таким логином уже существует'));
      }

      const hashedPassword = await bcrypt.hash(rawPassword, 12);

      const courier = await prisma.couriers.create({
        data: { login: normalizedLogin, password: hashedPassword, name, full_name, courier_type }
      });

      const token = CourierAuthController.generateToken({
        courier_id: courier.courier_id,
        login: courier.login || normalizedLogin,
        courier_type: courier.courier_type
      });

      await prisma.courier_token.create({
        data: { token, courier_id: courier.courier_id, log_timestamp: new Date() }
      });

      const { password: _pw, ...courierSafe } = courier as any;

      res.status(201).json({
        success: true,
        data: { courier: courierSafe, token },
        message: 'Курьер успешно зарегистрирован'
      });
    } catch (error: any) {
      console.error('Ошибка регистрации курьера:', error);
      next(createError(500, `Ошибка регистрации курьера: ${error.message}`));
    }
  }

  /**
   * Вход курьера
   * POST /api/courier/auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { login, password }: CourierLoginRequest = req.body;
      if (!login || !password) {
        return next(createError(400, 'Логин и пароль обязательны'));
      }

      const courier = await prisma.couriers.findFirst({ where: { login } });
      if (!courier || !courier.password) {
        return next(createError(401, 'Неверный логин или пароль'));
      }

      const stored = courier.password;
      let isValid = false;

      if (CourierAuthController.isBcryptHash(stored)) {
        // Пароль уже захэширован
        isValid = await bcrypt.compare(password, stored);
      } else {
        // Пароль в открытом виде (legacy) — сравниваем напрямую
        if (stored === password) {
          isValid = true;
          // Апгрейдим до bcrypt прямо сейчас
            try {
              const upgradedHash = await bcrypt.hash(password, 12);
              await prisma.couriers.update({
                where: { courier_id: courier.courier_id },
                data: { password: upgradedHash }
              });
              console.log(`Пароль курьера id=${courier.courier_id} автоматически захэширован (migration-on-login).`);
            } catch (e) {
              console.error('Не удалось обновить пароль до хэша:', e);
            }
        }
      }

      if (!isValid) {
        return next(createError(401, 'Неверный логин или пароль'));
      }

      const token = CourierAuthController.generateToken({
        courier_id: courier.courier_id,
        login: courier.login || login,
        courier_type: courier.courier_type
      });

      await prisma.courier_token.create({
        data: { token, courier_id: courier.courier_id, log_timestamp: new Date() }
      });

      const { password: _pw, ...courierSafe } = courier as any;

      res.json({
        success: true,
        data: { courier: courierSafe, token },
        message: 'Авторизация успешна'
      });
    } catch (error: any) {
      console.error('Ошибка авторизации курьера:', error);
      next(createError(500, `Ошибка авторизации курьера: ${error.message}`));
    }
  }

  /**
   * Выход курьера
   * POST /api/courier/auth/logout
   */
  static async logout(req: CourierAuthRequest, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return next(createError(400, 'Токен не предоставлен'));
      }
      await prisma.courier_token.deleteMany({ where: { token } });
      res.json({ success: true, data: null, message: 'Выход выполнен' });
    } catch (error: any) {
      console.error('Ошибка выхода курьера:', error);
      next(createError(500, `Ошибка выхода курьера: ${error.message}`));
    }
  }

  /**
   * Профиль курьера
   * GET /api/courier/auth/profile
   */
  static async getProfile(req: CourierAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.courier) {
        return next(createError(401, 'Курьер не авторизован'));
      }
      const courier = await prisma.couriers.findUnique({
        where: { courier_id: req.courier.courier_id },
        select: { courier_id: true, login: true, name: true, full_name: true, courier_type: true }
      });
      if (!courier) {
        return next(createError(404, 'Курьер не найден'));
      }
      res.json({ success: true, data: { courier }, message: 'Профиль получен' });
    } catch (error: any) {
      console.error('Ошибка получения профиля курьера:', error);
      next(createError(500, `Ошибка профиля курьера: ${error.message}`));
    }
  }

  /**
   * Смена пароля
   * PUT /api/courier/auth/change-password
   */
  static async changePassword(req: CourierAuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.courier) {
        return next(createError(401, 'Курьер не авторизован'));
      }
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return next(createError(400, 'Текущий и новый пароль обязательны'));
      }
      if (newPassword.length < 6) {
        return next(createError(400, 'Новый пароль должен содержать минимум 6 символов'));
      }
      if (!/[0-9]/.test(newPassword) || !/[A-Za-zА-Яа-я]/.test(newPassword)) {
        return next(createError(400, 'Новый пароль должен содержать буквы и цифры'));
      }
      const courier = await prisma.couriers.findUnique({ where: { courier_id: req.courier.courier_id } });
      if (!courier || !courier.password) {
        return next(createError(404, 'Курьер не найден'));
      }

      let validCurrent = false;
      if (CourierAuthController.isBcryptHash(courier.password)) {
        validCurrent = await bcrypt.compare(currentPassword, courier.password);
      } else {
        validCurrent = courier.password === currentPassword;
      }
      if (!validCurrent) {
        return next(createError(401, 'Неверный текущий пароль'));
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      await prisma.couriers.update({ where: { courier_id: courier.courier_id }, data: { password: hashed } });
      res.json({ success: true, data: null, message: 'Пароль изменен' });
    } catch (error: any) {
      console.error('Ошибка смены пароля курьера:', error);
      next(createError(500, `Ошибка смены пароля курьера: ${error.message}`));
    }
  }

  private static generateToken(payload: Omit<CourierJWTPayload, 'iat' | 'exp'>): string {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    if (!secret) throw new Error('JWT_SECRET не установлен');
    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  static verifyToken(token: string): CourierJWTPayload {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET не установлен');
    return jwt.verify(token, secret) as CourierJWTPayload;
  }

  private static isBcryptHash(value: string): boolean {
    return /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
  }
}

export default CourierAuthController;

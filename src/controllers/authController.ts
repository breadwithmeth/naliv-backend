import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import Prelude from '@prelude.so/sdk';
import { Verification } from '@prelude.so/sdk/resources/verification';
import { randomUUID } from 'crypto';

// Инициализация Prelude SDK (использует PRELUDE_API_KEY из окружения)
const preludeClient = new Prelude({ apiToken: "sk_5F8dG5g52vAcmDGgjj3iGeW7HYza1KHg" });

// Отправка SMS кода через Prelude SDK
async function sendSMSViaPrelude(phoneNumber: string): Promise<boolean> {
  try {
    
    const verification = await preludeClient.verification.create({
      target: { type: 'phone_number', value: phoneNumber },
    });
    console.log('Prelude verification created', verification?.id);
    console.log('Prelude send', verification);
    return true;
  } catch (err) {
    console.error('Prelude send error', err);
    return false;
  }
}

// Проверка кода через Prelude SDK
async function checkVerificationCodeViaPrelude(phoneNumber: string, code: string): Promise<boolean> {
  try {
    const check = await preludeClient.verification.check({
      target: { type: 'phone_number', value: phoneNumber },
      code,
      // Игнорируем истечение срока действия кода для тестирования
    });
    console.log('Prelude check', check?.id);
    // SDK бросит ошибку если код неверен; если дошли сюда — успех
    return true;
  } catch (err) {
    console.error('Prelude check error', err);
    return false;
  }
}

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

      // Создаём новую бонусную (дисконтную) карту ВСЕГДА при регистрации
      await AuthController.createBonusCard(newUser.user_id);

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

      // Создаём новую бонусную (дисконтную) карту при каждом успешном логине
      await AuthController.createBonusCard(user.user_id);

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
   * Получить всю информацию о текущем пользователе: профиль, адреса и сохраненные карты
   * GET /api/auth/full-info
   */
  static async getFullInfo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(createError(401, 'Пользователь не авторизован'));
      }
      const userId = req.user.user_id;
      // Профиль пользователя
      const user = await prisma.user.findUnique({
        where: { user_id: userId },
        select: {
          user_id: true,
          name: true,
          first_name: true,
          last_name: true,
          login: true,
          date_of_birth: true,
          sex: true,
          log_timestamp: true
        }
      });
      if (!user) {
        return next(createError(404, 'Пользователь не найден'));
      }
      // Адреса пользователя
      const addresses = await prisma.user_addreses.findMany({
        where: { user_id: userId, isDeleted: 0 },
        orderBy: { log_timestamp: 'desc' }
      });
      // Сохраненные карты пользователя
      const cardsRaw = await prisma.$queryRaw<any[]>`
        SELECT MAX(card_id) as card_id, CONCAT('**** **** **** ', RIGHT(card_mask, 4)) as mask
        FROM halyk_saved_cards
        WHERE user_id = ${userId}
        GROUP BY card_mask
        ORDER BY MAX(card_id) DESC
      `;
      const cards = cardsRaw.map(c => ({ card_id: c.card_id, mask: c.mask }));
      res.json({
        success: true,
        data: { user, addresses, cards },
        message: 'Полная информация о пользователе получена'
      });
    } catch (error: any) {
      console.error('Ошибка получения полной информации пользователя:', error);
      next(createError(500, `Ошибка получения информации: ${error.message}`));
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
   * Создание новой бонусной (дисконтной) карты пользователю.
   * Бизнес-требование: новая карта на каждую авторизацию.
   * Ошибки не пробрасываем наружу чтобы не ломать поток логина.
   */
  private static async createBonusCard(userId: number): Promise<void> {
    try {
      await prisma.bonus_cards.create({
        data: {
          user_id: userId,
          card_uuid: randomUUID()
        }
      });
      console.log('[bonus_cards] created', { userId, ts: new Date().toISOString() });
    } catch (err) {
      console.error('[bonus_cards] create error', { userId, error: (err as Error).message });
    }
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

  /**
   * Авторизация по одноразовому коду
   * POST /auth/verify-code
   */
  static async verifyCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone_number, onetime_code } = req.body;

      if (!phone_number || !onetime_code) {
        return next(createError(400, 'Номер телефона и одноразовый код обязательны'));
      }

      // Валидация формата номера телефона (+77077707600)
      const phoneRegex = /^\+7\d{10}$/;
      if (!phoneRegex.test(phone_number)) {
        return next(createError(400, 'Неверный формат номера телефона. Используйте формат +77077707600'));
      }

      // Проверяем код через Prelude API
      const isCodeValid = await checkVerificationCodeViaPrelude(phone_number, onetime_code);
      
      if (!isCodeValid) {
        return next(createError(401, 'Неверный код подтверждения'));
      }

      // Проверяем, что для этого номера был запрос на верификацию
      const verification = await prisma.phone_number_verify.findFirst({
        where: {
          phone_number: phone_number,
          onetime_code: 'PRELUDE',
          is_used: 0
        },
        orderBy: {
          log_timestamp: 'desc'
        }
      });

      if (!verification) {
        return next(createError(401, 'Не найден запрос на верификацию для данного номера'));
      }

      // Отмечаем верификацию как использованную
      await prisma.phone_number_verify.update({
        where: { verification_id: verification.verification_id },
        data: { is_used: 1 }
      });

      // Ищем пользователя по номеру телефона
      let user = await prisma.user.findFirst({
        where: { login: phone_number }
      });

      // Если пользователь не существует, создаем его
      if (!user) {
        user = await prisma.user.create({
          data: {
            login: phone_number
          }
        });

        // Создаем бонусную карту для нового пользователя
        
      }

      // Создаём новую бонусную (дисконтную) карту при авторизации через код (каждый успешный вход)
      await AuthController.createBonusCard(user.user_id);

      // Генерация временного пароля для входа по одноразовому коду
      const rawPassword = require('crypto').randomBytes(6).toString('hex');
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(rawPassword, saltRounds);
      // Обновляем пароль пользователя и помечаем как пользователя приложения
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: { 
          password: hashedPassword,
          is_app_user: 1
        }
      });

      // Удаляем старые токены пользователя (опционально)
      await prisma.users_tokens.deleteMany({
        where: { user_id: user.user_id }
      });

      // Создаем новый токен для пользователя
      const tokenData = await prisma.users_tokens.create({
        data: {
          user_id: user.user_id,
          token: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${user.user_id}` // Простая генерация токена
        }
      });

      // Создаем JWT токен
      const jwtPayload: JWTPayload = {
        user_id: user.user_id,
        login: user.login || phone_number
      };

      const jwtToken = AuthController.generateToken(jwtPayload);

      res.status(202).json({
        success: true,
        data: {
          user: {
            user_id: user.user_id,
            name: user.name,
            login: user.login,
            log_timestamp: user.log_timestamp
          },
          password: rawPassword,
          token: jwtToken,
          session_token: tokenData.token
        },
        message: 'Авторизация успешна'
      });

    } catch (error: any) {
      console.error('Ошибка авторизации по коду:', error);
      next(createError(500, `Ошибка авторизации: ${error.message}`));
    }
  }

  /**
   * Отправка одноразового кода (заглушка)
   * POST /auth/send-code
   */
  static async sendCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone_number } = req.body;

      if (!phone_number) {
        return next(createError(400, 'Номер телефона обязателен'));
      }

      // Валидация формата номера телефона
      const phoneRegex = /^\+7\d{10}$/;
      if (!phoneRegex.test(phone_number)) {
        return next(createError(400, 'Неверный формат номера телефона. Используйте формат +77077707600'));
      }

      // Удаляем старые неиспользованные коды для этого номера
      await prisma.phone_number_verify.deleteMany({
        where: {
          phone_number: phone_number,
          is_used: 0
        }
      });

      // Отправляем запрос на отправку кода через Prelude
      // Prelude сам генерирует и отправляет код
      const smsSent = await sendSMSViaPrelude(phone_number);
      
      if (!smsSent) {
        return next(createError(500, 'Ошибка отправки SMS. Попробуйте позже'));
      }

      // Создаем запись в базе данных для отслеживания запроса верификации
      // Код будет проверяться напрямую через Prelude API
      await prisma.phone_number_verify.create({
        data: {
          phone_number: phone_number,
          onetime_code: 'PRELUDE', // Короткий маркер что код управляется Prelude
          is_used: 0
        }
      });

      res.json({
        success: true,
        data: {
          phone_number: phone_number,
          message: "Код отправлен на указанный номер"
        },
        message: 'Код отправлен'
      });

    } catch (error: any) {
      console.error('Ошибка отправки кода:', error);
      next(createError(500, `Ошибка отправки кода: ${error.message}`));
    }
  }
}

export { AuthRequest };

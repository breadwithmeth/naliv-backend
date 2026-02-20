import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { generateDiscountCardCode12 } from '../utils/discountCardCode';
import axios from 'axios';

/**
 * Отправка кода верификации через WhatsApp
 * @param phoneNumber - Номер телефона в формате 77077707600 (без +)
 * @param code - 6-значный код
 */
async function sendCodeViaWhatsApp(phoneNumber: string, code: string): Promise<boolean> {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '958088394044701';
    
    if (!accessToken) {
      console.error('WHATSAPP_ACCESS_TOKEN не установлен');
      return false;
    }

    // Убираем + из номера если есть
    const cleanPhone = phoneNumber.replace(/^\+/, '');

    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
          name: 'r2',
          language: {
            code: 'ru'
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: code
                }
              ]
            }
          ]
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
return true;
  } catch (err: any) {
    console.error('WhatsApp send error:', err.response?.data || err.message);
    return false;
  }
}

/**
 * Генерация 6-значного кода
 */
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
          card_uuid: generateDiscountCardCode12()
        }
      });
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

      // Валидация формата кода (6 цифр)
      if (!/^\d{6}$/.test(onetime_code)) {
        return next(createError(400, 'Код должен состоять из 6 цифр'));
      }

      // Проверяем, что для этого номера был запрос на верификацию
      const verification = await prisma.phone_number_verify.findFirst({
        where: {
          phone_number: phone_number,
          is_used: 0
        },
        orderBy: {
          log_timestamp: 'desc'
        }
      });

      if (!verification) {
        return next(createError(401, 'Не найден запрос на верификацию для данного номера'));
      }

      // Проверка срока действия кода (10 минут)
      const codeAge = Date.now() - verification.log_timestamp.getTime();
      if (codeAge > 10 * 60 * 1000) {
        await prisma.phone_number_verify.update({
          where: { verification_id: verification.verification_id },
          data: { is_used: 1 }
        });
        return next(createError(401, 'Код истек. Запросите новый код'));
      }

      // Проверяем код
const isCodeValid = await bcrypt.compare(onetime_code, verification.onetime_code);
if (!isCodeValid) {
        return next(createError(401, 'Неверный код подтверждения'));
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
          token: crypto.randomBytes(32).toString('hex')
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
   * Обновление JWT по session_token (refresh) после авторизации по одноразовому коду
   * POST /auth/refresh
   * Body: { session_token: string }
   */
  static async refreshSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { session_token } = req.body as { session_token?: string };
      const token = String(session_token ?? '').trim();

      if (!token) {
        throw createError(400, 'session_token обязателен');
      }

      // Ищем сессию (refresh token) в users_tokens
      const session = await prisma.users_tokens.findFirst({
        where: { token },
        orderBy: { log_timestamp: 'desc' }
      });

      if (!session) {
        throw createError(401, 'Недействительный session_token');
      }

      const user = await prisma.user.findUnique({
        where: { user_id: session.user_id }
      });

      if (!user) {
        // На всякий случай чистим висячую сессию
        await prisma.users_tokens.deleteMany({ where: { token } });
        throw createError(401, 'Пользователь не найден');
      }

      // Ротируем session_token (обновляем запись)
      const newSessionToken = crypto.randomBytes(32).toString('hex');
      await prisma.users_tokens.update({
        where: { token_id: session.token_id },
        data: {
          token: newSessionToken,
          log_timestamp: new Date()
        }
      });

      const jwtPayload: JWTPayload = {
        user_id: user.user_id,
        login: user.login || ''
      };
      const jwtToken = AuthController.generateToken(jwtPayload);

      res.json({
        success: true,
        data: {
          token: jwtToken,
          session_token: newSessionToken,
          user: {
            user_id: user.user_id,
            name: user.name,
            login: user.login,
            log_timestamp: user.log_timestamp
          }
        },
        message: 'Токен обновлен'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отправка одноразового кода через WhatsApp
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

      // Проверка частоты запросов (не более 1 раза в минуту)
      const recentVerification = await prisma.phone_number_verify.findFirst({
        where: {
          phone_number: phone_number,
          log_timestamp: {
            gte: new Date(Date.now() - 60000) // 1 минута назад
          }
        },
        orderBy: { log_timestamp: 'desc' }
      });

      if (recentVerification) {
        return next(createError(429, 'Попробуйте отправить код позже. Подождите 1 минуту'));
      }

      // Удаляем старые неиспользованные коды для этого номера
      await prisma.phone_number_verify.deleteMany({
        where: {
          phone_number: phone_number,
          is_used: 0
        }
      });

      // Генерируем 6-значный код
      const verificationCode = generateVerificationCode();
// Хешируем код для безопасного хранения
      const hashedCode = await bcrypt.hash(verificationCode, 10);
// Сохраняем код в базе данных
      await prisma.phone_number_verify.create({
        data: {
          phone_number: phone_number,
          onetime_code: hashedCode,
          is_used: 0
        }
      });

      // Отправляем код через WhatsApp
      const messageSent = await sendCodeViaWhatsApp(phone_number, verificationCode);
      
      if (!messageSent) {
        return next(createError(500, 'Ошибка отправки сообщения. Попробуйте позже'));
      }

      res.json({
        success: true,
        data: {
          phone_number: phone_number,
          message: "Код отправлен в WhatsApp на указанный номер"
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

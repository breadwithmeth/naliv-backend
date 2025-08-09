import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import { SaveFcmTokenRequest, SaveFcmTokenResponse } from '../types/users';

interface AuthRequest extends Request {
  employee?: {
    employee_id: number;
    login: string;
    access_level: string;
  };
  user?: {
    user_id: number;
    login: string;
    name?: string;
  };
}

export class UserController {
  
  /**
   * Поиск пользователей по номеру телефона (только для сотрудников)
   * GET /api/users/search?phone=+77077707777
   */
  static async searchUsersByPhone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { phone } = req.query;

      // Проверяем авторизацию сотрудника
      if (!req.employee) {
        return next(createError(403, 'Доступ запрещен. Требуется авторизация сотрудника'));
      }

      if (!phone || typeof phone !== 'string') {
        return next(createError(400, 'Параметр phone обязателен'));
      }

      // Очищаем номер телефона от лишних символов
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      
      if (cleanPhone.length < 5) {
        return next(createError(400, 'Номер телефона слишком короткий для поиска'));
      }

      // Ищем пользователей по номеру телефона (частичное совпадение)
      const users = await prisma.user.findMany({
        where: {
          login: {
            contains: cleanPhone
          }
        },
        select: {
          user_id: true,
          name: true,
          first_name: true,
          last_name: true,
          login: true, // номер телефона
          date_of_birth: true,
          log_timestamp: true
        },
        take: 20, // Ограничиваем количество результатов
        orderBy: {
          log_timestamp: 'desc'
        }
      });

      // Дополнительная информация о пользователях
      const usersWithDetails = [];
      for (const user of users) {
        // Получаем количество заказов пользователя
        const ordersCount = await prisma.orders.count({
          where: { user_id: user.user_id }
        });

        // Получаем последний заказ
        const lastOrder = await prisma.orders.findFirst({
          where: { user_id: user.user_id },
          orderBy: { log_timestamp: 'desc' },
          select: {
            order_id: true,
            log_timestamp: true,
            business_id: true
          }
        });

        // Получаем информацию о бизнесе последнего заказа
        let lastOrderBusiness = null;
        if (lastOrder) {
          const business = await prisma.businesses.findUnique({
            where: { business_id: lastOrder.business_id || 0 },
            select: {
              business_id: true,
              name: true
            }
          });
          lastOrderBusiness = business;
        }

        usersWithDetails.push({
          ...user,
          orders_count: ordersCount,
          last_order: lastOrder ? {
            order_id: lastOrder.order_id,
            date: lastOrder.log_timestamp,
            business: lastOrderBusiness
          } : null
        });
      }

      res.json({
        success: true,
        data: {
          users: usersWithDetails,
          total_found: users.length,
          search_query: cleanPhone
        },
        message: `Найдено ${users.length} пользователей`
      });

    } catch (error: any) {
      console.error('Ошибка поиска пользователей:', error);
      next(createError(500, `Ошибка поиска пользователей: ${error.message}`));
    }
  }

  /**
   * Получение детальной информации о пользователе (только для сотрудников)
   * GET /api/users/:userId
   */
  static async getUserById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = parseInt(req.params.userId);

      // Проверяем авторизацию сотрудника
      if (!req.employee) {
        return next(createError(403, 'Доступ запрещен. Требуется авторизация сотрудника'));
      }

      if (isNaN(userId)) {
        return next(createError(400, 'Неверный ID пользователя'));
      }

      // Получаем информацию о пользователе
      const user = await prisma.user.findUnique({
        where: { user_id: userId },
        select: {
          user_id: true,
          name: true,
          first_name: true,
          last_name: true,
          login: true, // номер телефона
          date_of_birth: true,
          sex: true,
          log_timestamp: true
        }
      });

      if (!user) {
        return next(createError(404, 'Пользователь не найден'));
      }

      // Получаем статистику заказов
      const [ordersCount, totalSpent] = await Promise.all([
        prisma.orders.count({
          where: { user_id: userId }
        }),
        prisma.orders_cost.aggregate({
          where: {
            order_id: {
              in: await prisma.orders.findMany({
                where: { user_id: userId },
                select: { order_id: true }
              }).then(orders => orders.map(o => o.order_id))
            }
          },
          _sum: {
            cost: true
          }
        })
      ]);

      // Получаем последние 5 заказов
      const recentOrders = await prisma.orders.findMany({
        where: { user_id: userId },
        orderBy: { log_timestamp: 'desc' },
        take: 5,
        select: {
          order_id: true,
          order_uuid: true,
          log_timestamp: true,
          business_id: true,
          is_canceled: true
        }
      });

      // Получаем информацию о бизнесах для заказов
      const ordersWithBusiness = [];
      for (const order of recentOrders) {
        const business = await prisma.businesses.findUnique({
          where: { business_id: order.business_id || 0 },
          select: {
            business_id: true,
            name: true,
            address: true
          }
        });

        // Получаем стоимость заказа
        const cost = await prisma.orders_cost.findFirst({
          where: { order_id: order.order_id },
          select: { cost: true }
        });

        // Получаем статус заказа
        const status = await prisma.order_status.findFirst({
          where: { order_id: order.order_id },
          orderBy: { log_timestamp: 'desc' },
          select: { status: true, isCanceled: true }
        });

        ordersWithBusiness.push({
          ...order,
          business,
          cost: cost ? Number(cost.cost) : 0,
          status: status
        });
      }

      // Получаем адреса пользователя
      const addresses = await prisma.user_addreses.findMany({
        where: { 
          user_id: userId,
          isDeleted: 0
        },
        select: {
          address_id: true,
          address: true,
          name: true,
          apartment: true,
          entrance: true,
          floor: true,
          lat: true,
          lon: true
        }
      });

      res.json({
        success: true,
        data: {
          user,
          statistics: {
            orders_count: ordersCount,
            total_spent: totalSpent._sum.cost ? Number(totalSpent._sum.cost) : 0
          },
          recent_orders: ordersWithBusiness,
          addresses
        },
        message: 'Информация о пользователе получена'
      });

    } catch (error: any) {
      console.error('Ошибка получения информации о пользователе:', error);
      next(createError(500, `Ошибка получения информации о пользователе: ${error.message}`));
    }
  }

  /**
   * Сохранить FCM токен пользователя
   * POST /api/users/fcm-token
   * Body: { "fcmToken": "token_string" }
   * Требует авторизации - userId извлекается из JWT токена
   */
  static async saveFcmToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { fcmToken } = req.body;

      // Проверяем авторизацию
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const userId = req.user.user_id;

      // Валидация входных данных
      if (!fcmToken) {
        return next(createError(400, 'Поле fcmToken обязательно'));
      }

      if (typeof fcmToken !== 'string') {
        return next(createError(400, 'fcmToken должен быть строкой'));
      }

      if (fcmToken.trim().length === 0) {
        return next(createError(400, 'FCM токен не может быть пустым'));
      }

      // Обновляем FCM токен в поле OneSignalId
      const updatedUser = await prisma.user.update({
        where: { user_id: userId },
        data: { OneSignalId: fcmToken.trim() },
        select: {
          user_id: true,
          name: true,
          first_name: true,
          last_name: true,
          OneSignalId: true
        }
      });

      res.json({
        success: true,
        data: {
          user: updatedUser,
          message: 'FCM токен успешно сохранен'
        },
        message: 'FCM токен пользователя обновлен'
      });

    } catch (error: any) {
      console.error('Ошибка сохранения FCM токена:', error);
      next(createError(500, `Ошибка сохранения FCM токена: ${error.message}`));
    }
  }
}

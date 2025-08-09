import { Request, Response, NextFunction } from 'express';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';
import FirebaseAdminService from '../services/firebaseAdmin';

interface AuthRequest extends Request {
  user?: {
    user_id: number;
    login: string;
    name?: string;
  };
  employee?: {
    employee_id: number;
    login: string;
    access_level: string;
  };
}

/**
 * Интерфейс для отправки уведомления
 */
interface SendNotificationRequest {
  userId: number;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Интерфейс для отправки группового уведомления
 */
interface SendBulkNotificationRequest {
  userIds: number[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Интерфейс ответа FCM
 */
interface FCMResponse {
  success: number;
  failure: number;
  canonical_ids?: number;
  results?: Array<{
    message_id?: string;
    registration_id?: string;
    error?: string;
  }>;
}

export class NotificationController {

  /**
   * Отправить push-уведомление конкретному пользователю
   * POST /api/notifications/send
   * Body: { "userId": 123, "title": "Заголовок", "body": "Текст", "data": {...} }
   */
  static async sendNotificationToUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId, title, body, data }: SendNotificationRequest = req.body;

      // Валидация входных данных
      if (!userId || !title || !body) {
        return next(createError(400, 'Поля userId, title и body обязательны'));
      }

      if (typeof userId !== 'number' || typeof title !== 'string' || typeof body !== 'string') {
        return next(createError(400, 'Неверный тип данных'));
      }

      // Получаем FCM токен пользователя
      const user = await prisma.user.findUnique({
        where: { user_id: userId },
        select: {
          user_id: true,
          name: true,
          first_name: true,
          last_name: true,
          OneSignalId: true // FCM токен хранится здесь
        }
      });

      if (!user) {
        return next(createError(404, 'Пользователь не найден'));
      }

      if (!user.OneSignalId) {
        return next(createError(400, 'У пользователя нет FCM токена'));
      }

      // Валидация формата FCM токена
      const firebaseService = FirebaseAdminService.getInstance();
      const tokenValidation = await firebaseService.validateTokenFormat(user.OneSignalId);
      
      if (!tokenValidation.valid) {
        return next(createError(400, `Недействительный FCM токен: ${tokenValidation.reason}`));
      }

      // Отправляем push-уведомление через Firebase Admin SDK
      const pushResult = await NotificationController.sendFCMNotificationV2(
        user.OneSignalId,
        title,
        body,
        data
      );

      // Если токен недействителен, очищаем его из базы данных
      if (!pushResult.success && 
          (pushResult.error_code === 'messaging/registration-token-not-registered' ||
           pushResult.error_code === 'messaging/invalid-registration-token' ||
           pushResult.error_code === 'messaging/sender-id-mismatch')) {
        
        console.log(`Очищаем недействительный FCM токен для пользователя ${userId}`);
        await prisma.user.update({
          where: { user_id: userId },
          data: { OneSignalId: null }
        });
        
        return next(createError(400, `FCM токен недействителен и был удален из базы. ${pushResult.error}`));
      }

      // Сохраняем уведомление в базу данных
      const notification = await prisma.user_notifications.create({
        data: {
          user_id: userId,
          title: title,
          body: body,
          data: data ? JSON.stringify(data) : null,
          is_read: 0
        }
      });

      res.json({
        success: true,
        data: {
          notification: {
            id: notification.id,
            user_id: notification.user_id,
            title: notification.title,
            body: notification.body,
            data: notification.data ? JSON.parse(notification.data) : null,
            sent_at: notification.sent_at,
            is_read: notification.is_read === 1
          },
          push_result: pushResult,
          user: {
            user_id: user.user_id,
            name: user.name,
            first_name: user.first_name,
            last_name: user.last_name
          }
        },
        message: 'Уведомление успешно отправлено'
      });

    } catch (error: any) {
      console.error('Ошибка отправки уведомления:', error);
      next(createError(500, `Ошибка отправки уведомления: ${error.message}`));
    }
  }

  /**
   * Отправить push-уведомление группе пользователей
   * POST /api/notifications/send-bulk
   * Body: { "userIds": [1, 2, 3], "title": "Заголовок", "body": "Текст", "data": {...} }
   */
  static async sendBulkNotification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userIds, title, body, data }: SendBulkNotificationRequest = req.body;

      // Валидация входных данных
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return next(createError(400, 'Поле userIds должно быть массивом с ID пользователей'));
      }

      if (!title || !body) {
        return next(createError(400, 'Поля title и body обязательны'));
      }

      if (typeof title !== 'string' || typeof body !== 'string') {
        return next(createError(400, 'title и body должны быть строками'));
      }

      // Ограничиваем количество пользователей за раз
      if (userIds.length > 100) {
        return next(createError(400, 'Максимальное количество пользователей за раз: 100'));
      }

      // Получаем пользователей с FCM токенами
      const users = await prisma.user.findMany({
        where: {
          user_id: {
            in: userIds
          },
          OneSignalId: {
            not: null
          }
        },
        select: {
          user_id: true,
          name: true,
          first_name: true,
          last_name: true,
          OneSignalId: true
        }
      });

      if (users.length === 0) {
        return next(createError(400, 'Ни у одного из указанных пользователей нет FCM токена'));
      }

      const results = [];
      const notifications = [];

      // Отправляем уведомления каждому пользователю
      for (const user of users) {
        try {
          // Отправляем push-уведомление через Firebase Admin SDK
          const pushResult = await NotificationController.sendFCMNotificationV2(
            user.OneSignalId!,
            title,
            body,
            data
          );

          // Сохраняем уведомление в базу данных
          const notification = await prisma.user_notifications.create({
            data: {
              user_id: user.user_id,
              title: title,
              body: body,
              data: data ? JSON.stringify(data) : null,
              is_read: 0
            }
          });

          notifications.push(notification);
          results.push({
            user_id: user.user_id,
            success: true,
            push_result: pushResult
          });

        } catch (error: any) {
          console.error(`Ошибка отправки уведомления пользователю ${user.user_id}:`, error);
          results.push({
            user_id: user.user_id,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        data: {
          summary: {
            total_users: userIds.length,
            users_with_tokens: users.length,
            success_count: successCount,
            failure_count: failureCount
          },
          results: results,
          notifications: notifications.map(n => ({
            id: n.id,
            user_id: n.user_id,
            title: n.title,
            body: n.body,
            data: n.data ? JSON.parse(n.data) : null,
            sent_at: n.sent_at,
            is_read: n.is_read === 1
          }))
        },
        message: `Уведомления отправлены: ${successCount} успешно, ${failureCount} с ошибками`
      });

    } catch (error: any) {
      console.error('Ошибка массовой отправки уведомлений:', error);
      next(createError(500, `Ошибка массовой отправки уведомлений: ${error.message}`));
    }
  }

  /**
   * Получить уведомления пользователя (требует авторизации)
   * GET /api/notifications/my?page=1&limit=20
   */
  static async getUserNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const userId = req.user.user_id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      // Получаем уведомления пользователя
      const [notifications, totalCount] = await Promise.all([
        prisma.user_notifications.findMany({
          where: { user_id: userId },
          orderBy: { sent_at: 'desc' },
          skip: offset,
          take: limit
        }),
        prisma.user_notifications.count({
          where: { user_id: userId }
        })
      ]);

      // Получаем количество непрочитанных уведомлений
      const unreadCount = await prisma.user_notifications.count({
        where: {
          user_id: userId,
          is_read: 0
        }
      });

      const totalPages = Math.ceil(totalCount / limit);

      res.json({
        success: true,
        data: {
          notifications: notifications.map(n => ({
            id: n.id,
            title: n.title,
            body: n.body,
            data: n.data ? JSON.parse(n.data) : null,
            sent_at: n.sent_at,
            is_read: n.is_read === 1
          })),
          pagination: {
            current_page: page,
            total_pages: totalPages,
            total_count: totalCount,
            per_page: limit,
            has_next: page < totalPages,
            has_prev: page > 1
          },
          unread_count: unreadCount
        },
        message: 'Уведомления получены'
      });

    } catch (error: any) {
      console.error('Ошибка получения уведомлений:', error);
      next(createError(500, `Ошибка получения уведомлений: ${error.message}`));
    }
  }

  /**
   * Отметить уведомление как прочитанное
   * PUT /api/notifications/:notificationId/read
   */
  static async markNotificationAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const userId = req.user.user_id;
      const notificationId = parseInt(req.params.notificationId);

      if (isNaN(notificationId)) {
        return next(createError(400, 'Неверный ID уведомления'));
      }

      // Проверяем существование уведомления и принадлежность пользователю
      const notification = await prisma.user_notifications.findFirst({
        where: {
          id: notificationId,
          user_id: userId
        }
      });

      if (!notification) {
        return next(createError(404, 'Уведомление не найдено'));
      }

      // Отмечаем как прочитанное
      const updatedNotification = await prisma.user_notifications.update({
        where: { id: notificationId },
        data: { is_read: 1 }
      });

      res.json({
        success: true,
        data: {
          notification: {
            id: updatedNotification.id,
            title: updatedNotification.title,
            body: updatedNotification.body,
            data: updatedNotification.data ? JSON.parse(updatedNotification.data) : null,
            sent_at: updatedNotification.sent_at,
            is_read: updatedNotification.is_read === 1
          }
        },
        message: 'Уведомление отмечено как прочитанное'
      });

    } catch (error: any) {
      console.error('Ошибка обновления уведомления:', error);
      next(createError(500, `Ошибка обновления уведомления: ${error.message}`));
    }
  }

  /**
   * Отметить все уведомления пользователя как прочитанные
   * PUT /api/notifications/mark-all-read
   */
  static async markAllNotificationsAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию
      if (!req.user) {
        return next(createError(401, 'Требуется авторизация'));
      }

      const userId = req.user.user_id;

      // Отмечаем все уведомления как прочитанные
      const result = await prisma.user_notifications.updateMany({
        where: {
          user_id: userId,
          is_read: 0
        },
        data: { is_read: 1 }
      });

      res.json({
        success: true,
        data: {
          updated_count: result.count
        },
        message: `Отмечено как прочитанных: ${result.count} уведомлений`
      });

    } catch (error: any) {
      console.error('Ошибка массового обновления уведомлений:', error);
      next(createError(500, `Ошибка массового обновления уведомлений: ${error.message}`));
    }
  }

  /**
   * Диагностика FCM токена пользователя
   * POST /api/notifications/test-token
   * Body: { "userId": 123 } или используется авторизованный пользователь
   */
  static async testFcmToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId: requestUserId } = req.body;
      
      // Определяем ID пользователя
      let userId: number;
      if (req.employee && requestUserId) {
        // Сотрудник может тестировать токен любого пользователя
        userId = requestUserId;
      } else if (req.user) {
        // Пользователь может тестировать только свой токен
        userId = req.user.user_id;
      } else {
        return next(createError(401, 'Требуется авторизация'));
      }

      // Получаем пользователя и его FCM токен
      const user = await prisma.user.findUnique({
        where: { user_id: userId },
        select: {
          user_id: true,
          name: true,
          first_name: true,
          last_name: true,
          OneSignalId: true
        }
      });

      if (!user) {
        return next(createError(404, 'Пользователь не найден'));
      }

      const diagnostics: any = {
        user_id: user.user_id,
        user_name: user.name || `${user.first_name} ${user.last_name}`.trim() || 'Без имени',
        has_token: !!user.OneSignalId,
        token_preview: user.OneSignalId ? `${user.OneSignalId.substring(0, 20)}...` : null
      };

      if (!user.OneSignalId) {
        diagnostics.status = 'no_token';
        diagnostics.message = 'У пользователя нет FCM токена';
      } else {
        // Валидация формата токена
        const firebaseService = FirebaseAdminService.getInstance();
        const formatValidation = await firebaseService.validateTokenFormat(user.OneSignalId);
        
        diagnostics.format_valid = formatValidation.valid;
        diagnostics.format_reason = formatValidation.reason;

        if (!formatValidation.valid) {
          diagnostics.status = 'invalid_format';
          diagnostics.message = `Неверный формат токена: ${formatValidation.reason}`;
        } else {
          // Отправляем тестовое уведомление
          const testResult = await NotificationController.sendFCMNotificationV2(
            user.OneSignalId,
            '🧪 Тест уведомления',
            'Это тестовое уведомление для проверки FCM токена',
            { 
              test: 'true',
              timestamp: new Date().toISOString(),
              source: 'diagnostics'
            }
          );

          diagnostics.test_result = testResult;
          
          if (testResult.success) {
            diagnostics.status = 'success';
            diagnostics.message = 'FCM токен работает корректно';
            
            // Сохраняем тестовое уведомление в базу данных
            await prisma.user_notifications.create({
              data: {
                user_id: userId,
                title: '🧪 Тест уведомления',
                body: 'Это тестовое уведомление для проверки FCM токена',
                data: JSON.stringify({ 
                  test: 'true',
                  timestamp: new Date().toISOString(),
                  source: 'diagnostics'
                }),
                is_read: 0
              }
            });
          } else {
            diagnostics.status = 'send_failed';
            diagnostics.message = `Не удалось отправить уведомление: ${testResult.error}`;
            
            // Если токен недействителен, предлагаем его очистить
            if (testResult.error_code === 'messaging/registration-token-not-registered' ||
                testResult.error_code === 'messaging/invalid-registration-token' ||
                testResult.error_code === 'messaging/sender-id-mismatch') {
              diagnostics.should_cleanup = true;
              diagnostics.cleanup_reason = 'Токен недействителен и должен быть удален';
            }
          }
        }
      }

      // Информация о Firebase проекте
      const firebaseService = FirebaseAdminService.getInstance();
      diagnostics.firebase_info = firebaseService.getProjectInfo();

      res.json({
        success: true,
        data: {
          diagnostics: diagnostics
        },
        message: 'Диагностика FCM токена завершена'
      });

    } catch (error: any) {
      console.error('Ошибка диагностики FCM токена:', error);
      next(createError(500, `Ошибка диагностики FCM токена: ${error.message}`));
    }
  }

  /**
   * Очистить недействительный FCM токен пользователя
   * DELETE /api/notifications/cleanup-token
   * Body: { "userId": 123 } или используется авторизованный пользователь
   */
  static async cleanupFcmToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId: requestUserId } = req.body;
      
      // Определяем ID пользователя
      let userId: number;
      if (req.employee && requestUserId) {
        // Сотрудник может очищать токен любого пользователя
        userId = requestUserId;
      } else if (req.user) {
        // Пользователь может очищать только свой токен
        userId = req.user.user_id;
      } else {
        return next(createError(401, 'Требуется авторизация'));
      }

      // Проверяем существование пользователя
      const user = await prisma.user.findUnique({
        where: { user_id: userId },
        select: {
          user_id: true,
          name: true,
          OneSignalId: true
        }
      });

      if (!user) {
        return next(createError(404, 'Пользователь не найден'));
      }

      if (!user.OneSignalId) {
        return next(createError(400, 'У пользователя нет FCM токена для очистки'));
      }

      // Очищаем токен
      await prisma.user.update({
        where: { user_id: userId },
        data: { OneSignalId: null }
      });

      res.json({
        success: true,
        data: {
          user_id: userId,
          user_name: user.name,
          cleared_token_preview: `${user.OneSignalId.substring(0, 20)}...`
        },
        message: 'FCM токен успешно очищен'
      });

    } catch (error: any) {
      console.error('Ошибка очистки FCM токена:', error);
      next(createError(500, `Ошибка очистки FCM токена: ${error.message}`));
    }
  }

  /**
   * Отправка FCM уведомления через Firebase Admin SDK
   * Современный подход вместо устаревшего HTTP API
   */
  private static async sendFCMNotificationV2(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<any> {
    try {
      const firebaseService = FirebaseAdminService.getInstance();
      
      // Инициализируем Firebase Admin SDK если еще не инициализирован
      firebaseService.initialize();
      
      const result = await firebaseService.sendNotification(fcmToken, title, body, data);
      
      return result;

    } catch (error: any) {
      console.error('Ошибка отправки FCM через Admin SDK:', error);
      
      return {
        success: false,
        error: error.message,
        method: 'firebase_admin_sdk'
      };
    }
  }

  /**
   * Отправка FCM уведомления (устаревший метод для обратной совместимости)
   * @deprecated Используйте sendFCMNotificationV2 с Firebase Admin SDK
   */
  private static async sendFCMNotification(
    fcmToken: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<any> {
    console.warn('Используется устаревший метод sendFCMNotification. Рекомендуется использовать Firebase Admin SDK');
    
    // Fallback на новый метод
    return await NotificationController.sendFCMNotificationV2(fcmToken, title, body, data);
  }
}

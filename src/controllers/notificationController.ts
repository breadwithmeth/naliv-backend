import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import prisma from '../database';
import { createError } from '../middleware/errorHandler';

// Интерфейсы для типизации
interface AuthRequest extends Request {
  user?: {
    user_id: number;
    login: string;
  };
}

interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

interface OrderNotificationData {
  order_id: number;
  order_uuid: string;
  status: string;
  business_name?: string;
  total_cost?: number;
}

export class NotificationController {
  
  /**
   * Инициализация Firebase Admin SDK
   */
  static async initializeFirebase(): Promise<void> {
    try {
      // Проверяем, не инициализирован ли уже Firebase
      if (admin.apps.length === 0) {
        // Получаем данные для инициализации из переменных окружения
        const serviceAccount = {
          type: process.env.FIREBASE_TYPE || "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
          token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
        };

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
          projectId: process.env.FIREBASE_PROJECT_ID
        });

        console.log('✅ Firebase Admin SDK инициализирован');
      }
    } catch (error: any) {
      console.error('❌ Ошибка инициализации Firebase:', error);
      throw new Error(`Не удалось инициализировать Firebase: ${error.message}`);
    }
  }

  /**
   * Сохранить FCM токен пользователя
   * POST /api/notifications/register-token
   */
  static async registerFCMToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const { fcm_token, device_type = 'unknown', device_id } = req.body;

      if (!fcm_token) {
        return next(createError(400, 'FCM токен обязателен'));
      }

      const userId = req.user.user_id;

      // Проверяем, существует ли уже такой токен для пользователя
      const existingToken = await prisma.user_fcm_tokens.findFirst({
        where: {
          user_id: userId,
          fcm_token: fcm_token
        }
      });

      if (existingToken) {
        // Обновляем timestamp последнего использования
        await prisma.user_fcm_tokens.update({
          where: { id: existingToken.id },
          data: { 
            updated_at: new Date(),
            device_type: device_type,
            device_id: device_id
          }
        });

        console.log(`FCM токен обновлен для пользователя ${userId}`);
      } else {
        // Создаем новую запись
        await prisma.user_fcm_tokens.create({
          data: {
            user_id: userId,
            fcm_token: fcm_token,
            device_type: device_type,
            device_id: device_id,
            is_active: 1,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        console.log(`Новый FCM токен зарегистрирован для пользователя ${userId}`);
      }

      res.json({
        success: true,
        message: 'FCM токен успешно зарегистрирован'
      });

    } catch (error: any) {
      console.error('Ошибка регистрации FCM токена:', error);
      next(createError(500, `Ошибка регистрации токена: ${error.message}`));
    }
  }

  /**
   * Удалить FCM токен пользователя
   * DELETE /api/notifications/unregister-token
   */
  static async unregisterFCMToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const { fcm_token } = req.body;

      if (!fcm_token) {
        return next(createError(400, 'FCM токен обязателен'));
      }

      const userId = req.user.user_id;

      // Деактивируем токен
      const result = await prisma.user_fcm_tokens.updateMany({
        where: {
          user_id: userId,
          fcm_token: fcm_token
        },
        data: {
          is_active: 0,
          updated_at: new Date()
        }
      });

      if (result.count === 0) {
        return next(createError(404, 'FCM токен не найден'));
      }

      console.log(`FCM токен деактивирован для пользователя ${userId}`);

      res.json({
        success: true,
        message: 'FCM токен успешно удален'
      });

    } catch (error: any) {
      console.error('Ошибка удаления FCM токена:', error);
      next(createError(500, `Ошибка удаления токена: ${error.message}`));
    }
  }

  /**
   * Отправить уведомление конкретному пользователю
   * POST /api/notifications/send-to-user
   */
  static async sendNotificationToUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        user_id, 
        title, 
        body, 
        data = {}, 
        imageUrl,
        sound = 'default',
        badge 
      } = req.body;

      if (!user_id || !title || !body) {
        return next(createError(400, 'Обязательные поля: user_id, title, body'));
      }

      // Инициализируем Firebase, если еще не инициализирован
      await NotificationController.initializeFirebase();

      // Получаем активные FCM токены пользователя
      const fcmTokens = await prisma.user_fcm_tokens.findMany({
        where: {
          user_id: user_id,
          is_active: 1
        }
      });

      if (fcmTokens.length === 0) {
        return res.json({
          success: false,
          message: 'У пользователя нет активных устройств для уведомлений',
          sent_count: 0
        });
      }

      const tokens = fcmTokens.map(token => token.fcm_token);
      let successCount = 0;
      let failureCount = 0;
      const invalidTokens: string[] = [];

      // Отправляем уведомления
      for (const token of tokens) {
        try {
          const message = {
            token: token,
            notification: {
              title: title,
              body: body,
              ...(imageUrl && { imageUrl })
            },
            data: {
              ...data,
              click_action: 'FLUTTER_NOTIFICATION_CLICK',
              sound: sound
            },
            android: {
              notification: {
                channelId: 'naliv_orders',
                priority: 'high' as const,
                defaultSound: true,
                ...(badge && { notificationCount: badge })
              }
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: title,
                    body: body
                  },
                  sound: sound,
                  ...(badge && { badge: badge })
                }
              }
            }
          };

          const response = await admin.messaging().send(message);
          console.log(`✅ Уведомление отправлено: ${response}`);
          successCount++;

        } catch (error: any) {
          console.error(`❌ Ошибка отправки уведомления на токен ${token}:`, error);
          failureCount++;

          // Если токен недействителен, помечаем его для удаления
          if (error.code === 'messaging/registration-token-not-registered' || 
              error.code === 'messaging/invalid-registration-token') {
            invalidTokens.push(token);
          }
        }
      }

      // Деактивируем недействительные токены
      if (invalidTokens.length > 0) {
        await prisma.user_fcm_tokens.updateMany({
          where: {
            fcm_token: { in: invalidTokens }
          },
          data: {
            is_active: 0,
            updated_at: new Date()
          }
        });
        console.log(`Деактивировано ${invalidTokens.length} недействительных токенов`);
      }

      // Сохраняем запись об отправленном уведомлении
      await prisma.user_notifications.create({
        data: {
          user_id: user_id,
          title: title,
          body: body,
          data: JSON.stringify(data),
          sent_at: new Date(),
          is_read: 0
        }
      });

      res.json({
        success: true,
        message: `Уведомление отправлено на ${successCount} устройств`,
        sent_count: successCount,
        failed_count: failureCount,
        invalid_tokens_removed: invalidTokens.length
      });

    } catch (error: any) {
      console.error('Ошибка отправки уведомления:', error);
      next(createError(500, `Ошибка отправки уведомления: ${error.message}`));
    }
  }

  /**
   * Отправить уведомление о статусе заказа
   */
  static async sendOrderStatusNotification(orderData: OrderNotificationData): Promise<void> {
    try {
      await NotificationController.initializeFirebase();

      // Получаем информацию о заказе
      const order = await prisma.orders.findUnique({
        where: { order_id: orderData.order_id }
      });

      if (!order) {
        console.error(`Заказ ${orderData.order_id} не найден`);
        return;
      }

      // Получаем стоимость заказа
      const orderCost = await prisma.orders_cost.findFirst({
        where: { order_id: orderData.order_id }
      });

      // Получаем информацию о бизнесе
      const business = await prisma.businesses.findUnique({
        where: { business_id: order.business_id || 1 }
      });

      // Формируем сообщение в зависимости от статуса
      let title = '';
      let body = '';
      let notificationType = 'order_status';

      switch (orderData.status) {
        case 'created':
          title = '🛍️ Заказ оформлен';
          body = `Ваш заказ №${orderData.order_uuid} принят в обработку`;
          break;
        case 'paid':
          title = '💳 Заказ оплачен';
          body = `Оплата заказа №${orderData.order_uuid} прошла успешно`;
          break;
        case 'preparing':
          title = '👨‍🍳 Заказ готовится';
          body = `Ваш заказ №${orderData.order_uuid} готовится в ${business?.name || 'магазине'}`;
          break;
        case 'ready':
          title = '✅ Заказ готов';
          body = `Заказ №${orderData.order_uuid} готов к получению`;
          break;
        case 'delivering':
          title = '🚗 Заказ в пути';
          body = `Курьер везет ваш заказ №${orderData.order_uuid}`;
          break;
        case 'delivered':
          title = '🎉 Заказ доставлен';
          body = `Заказ №${orderData.order_uuid} успешно доставлен!`;
          break;
        case 'cancelled':
          title = '❌ Заказ отменен';
          body = `Заказ №${orderData.order_uuid} был отменен`;
          break;
        default:
          title = '📱 Обновление заказа';
          body = `Статус заказа №${orderData.order_uuid} изменился`;
      }

      const notificationData = {
        order_id: orderData.order_id.toString(),
        order_uuid: orderData.order_uuid,
        status: orderData.status,
        business_name: business?.name || '',
        total_cost: orderCost?.cost?.toString() || '0',
        type: notificationType,
        timestamp: new Date().toISOString()
      };

      // Получаем FCM токены пользователя
      const fcmTokens = await prisma.user_fcm_tokens.findMany({
        where: {
          user_id: order.user_id,
          is_active: 1
        }
      });

      if (fcmTokens.length === 0) {
        console.log(`У пользователя ${order.user_id} нет активных устройств для уведомлений`);
        return;
      }

      const tokens = fcmTokens.map(token => token.fcm_token);
      let successCount = 0;
      const invalidTokens: string[] = [];

      // Отправляем уведомления на все устройства пользователя
      for (const token of tokens) {
        try {
          const message = {
            token: token,
            notification: {
              title: title,
              body: body
            },
            data: notificationData,
            android: {
              notification: {
                channelId: 'naliv_orders',
                priority: 'high' as const,
                defaultSound: true,
                color: '#FF6B35',
                icon: 'ic_notification'
              }
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: title,
                    body: body
                  },
                  sound: 'default',
                  badge: 1
                }
              }
            }
          };

          await admin.messaging().send(message);
          successCount++;
          console.log(`✅ Уведомление о заказе отправлено пользователю ${order.user_id}`);

        } catch (error: any) {
          console.error(`❌ Ошибка отправки уведомления о заказе:`, error);
          
          if (error.code === 'messaging/registration-token-not-registered' || 
              error.code === 'messaging/invalid-registration-token') {
            invalidTokens.push(token);
          }
        }
      }

      // Деактивируем недействительные токены
      if (invalidTokens.length > 0) {
        await prisma.user_fcm_tokens.updateMany({
          where: {
            fcm_token: { in: invalidTokens }
          },
          data: {
            is_active: 0,
            updated_at: new Date()
          }
        });
      }

      // Сохраняем уведомление в истории
      await prisma.user_notifications.create({
        data: {
          user_id: order.user_id,
          title: title,
          body: body,
          data: JSON.stringify(notificationData),
          sent_at: new Date(),
          is_read: 0
        }
      });

      console.log(`📱 Уведомление о заказе отправлено на ${successCount} устройств`);

    } catch (error: any) {
      console.error('Ошибка отправки уведомления о заказе:', error);
    }
  }

  /**
   * Получить историю уведомлений пользователя
   * GET /api/notifications/history
   */
  static async getNotificationHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const { limit = 50, offset = 0, unread_only = false } = req.query;

      const notifications = await prisma.user_notifications.findMany({
        where: {
          user_id: req.user.user_id,
          ...(unread_only === 'true' && { is_read: 0 })
        },
        orderBy: {
          sent_at: 'desc'
        },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      });

      // Подсчитываем общее количество непрочитанных
      const unreadCount = await prisma.user_notifications.count({
        where: {
          user_id: req.user.user_id,
          is_read: 0
        }
      });

      res.json({
        success: true,
        data: {
          notifications: notifications.map(notification => ({
            id: notification.id,
            title: notification.title,
            body: notification.body,
            data: notification.data ? JSON.parse(notification.data) : null,
            sent_at: notification.sent_at,
            is_read: notification.is_read === 1,
            created_at: notification.sent_at
          })),
          unread_count: unreadCount,
          total_count: notifications.length
        },
        message: 'История уведомлений получена'
      });

    } catch (error: any) {
      console.error('Ошибка получения истории уведомлений:', error);
      next(createError(500, `Ошибка получения истории: ${error.message}`));
    }
  }

  /**
   * Отметить уведомления как прочитанные
   * POST /api/notifications/mark-as-read
   */
  static async markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const { notification_ids, all = false } = req.body;

      if (all) {
        // Отмечаем все уведомления как прочитанные
        await prisma.user_notifications.updateMany({
          where: {
            user_id: req.user.user_id,
            is_read: 0
          },
          data: {
            is_read: 1
          }
        });

        res.json({
          success: true,
          message: 'Все уведомления отмечены как прочитанные'
        });
      } else {
        if (!notification_ids || !Array.isArray(notification_ids)) {
          return next(createError(400, 'Необходимо указать массив ID уведомлений'));
        }

        await prisma.user_notifications.updateMany({
          where: {
            id: { in: notification_ids },
            user_id: req.user.user_id
          },
          data: {
            is_read: 1
          }
        });

        res.json({
          success: true,
          message: `${notification_ids.length} уведомлений отмечены как прочитанные`
        });
      }

    } catch (error: any) {
      console.error('Ошибка отметки уведомлений как прочитанных:', error);
      next(createError(500, `Ошибка отметки как прочитанных: ${error.message}`));
    }
  }

  /**
   * Тестовая отправка уведомления
   * POST /api/notifications/test
   */
  static async sendTestNotification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const { title = 'Тестовое уведомление', body = 'Это тестовое уведомление от Naliv.kz' } = req.body;

      await NotificationController.initializeFirebase();

      // Получаем FCM токены пользователя
      const fcmTokens = await prisma.user_fcm_tokens.findMany({
        where: {
          user_id: req.user.user_id,
          is_active: 1
        }
      });

      if (fcmTokens.length === 0) {
        return res.json({
          success: false,
          message: 'У вас нет зарегистрированных устройств для уведомлений'
        });
      }

      const testData = {
        type: 'test',
        timestamp: new Date().toISOString(),
        user_id: req.user.user_id.toString()
      };

      let successCount = 0;

      for (const tokenRecord of fcmTokens) {
        try {
          const message = {
            token: tokenRecord.fcm_token,
            notification: {
              title: title,
              body: body
            },
            data: testData,
            android: {
              notification: {
                channelId: 'naliv_test',
                priority: 'default' as const,
                defaultSound: true
              }
            },
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: title,
                    body: body
                  },
                  sound: 'default'
                }
              }
            }
          };

          await admin.messaging().send(message);
          successCount++;

        } catch (error: any) {
          console.error('Ошибка отправки тестового уведомления:', error);
        }
      }

      res.json({
        success: true,
        message: `Тестовое уведомление отправлено на ${successCount} устройств`,
        devices_count: fcmTokens.length,
        success_count: successCount
      });

    } catch (error: any) {
      console.error('Ошибка отправки тестового уведомления:', error);
      next(createError(500, `Ошибка отправки тестового уведомления: ${error.message}`));
    }
  }
}

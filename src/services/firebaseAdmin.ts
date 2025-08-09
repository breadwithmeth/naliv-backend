import admin from 'firebase-admin';

/**
 * Firebase Admin SDK сервис
 * Современный подход для работы с Firebase Cloud Messaging
 */
class FirebaseAdminService {
  private static instance: FirebaseAdminService;
  private isInitialized: boolean = false;

  private constructor() {}

  /**
   * Получить единственный экземпляр сервиса (Singleton)
   */
  public static getInstance(): FirebaseAdminService {
    if (!FirebaseAdminService.instance) {
      FirebaseAdminService.instance = new FirebaseAdminService();
    }
    return FirebaseAdminService.instance;
  }

  /**
   * Инициализация Firebase Admin SDK
   */
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.warn('Firebase Admin SDK не настроен. Проверьте переменные окружения: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
      return;
    }

    try {
      // Проверяем, не инициализирован ли уже Firebase
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: projectId,
            clientEmail: clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n') // Заменяем \\n на настоящие переносы строк
          })
        });
      }

      this.isInitialized = true;
      console.log('✅ Firebase Admin SDK успешно инициализирован');
    } catch (error: any) {
      console.error('❌ Ошибка инициализации Firebase Admin SDK:', error.message);
      throw error;
    }
  }

  /**
   * Отправить push-уведомление через Firebase Admin SDK
   */
  public async sendNotification(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Firebase Admin SDK не инициализирован');
    }

    try {
      const message: admin.messaging.Message = {
        token: token,
        notification: {
          title: title,
          body: body
        },
        data: data || {}
      };

      const result = await admin.messaging().send(message);
      
      return {
        success: true,
        message_id: result,
        method: 'firebase_admin_sdk'
      };

    } catch (error: any) {
      console.error('Ошибка отправки FCM через Admin SDK:', error);
      
      // Детальная обработка ошибок FCM
      let errorMessage = error.message;
      let shouldRetry = false;
      
      if (error.code) {
        switch (error.code) {
          case 'messaging/registration-token-not-registered':
            errorMessage = 'FCM токен не зарегистрирован или устройство удалило приложение';
            break;
          case 'messaging/invalid-registration-token':
            errorMessage = 'Неверный формат FCM токена';
            break;
          case 'messaging/third-party-auth-error':
            errorMessage = 'Ошибка авторизации APNS/Web Push. Проверьте настройки Firebase проекта';
            break;
          case 'messaging/invalid-argument':
            errorMessage = 'Неверные параметры сообщения';
            break;
          case 'messaging/quota-exceeded':
            errorMessage = 'Превышена квота отправки сообщений';
            shouldRetry = true;
            break;
          case 'messaging/sender-id-mismatch':
            errorMessage = 'FCM токен принадлежит другому Firebase проекту';
            break;
          case 'messaging/unavailable':
            errorMessage = 'Сервис FCM временно недоступен';
            shouldRetry = true;
            break;
          default:
            errorMessage = `FCM ошибка: ${error.code} - ${error.message}`;
        }
      }

      return {
        success: false,
        error: errorMessage,
        error_code: error.code,
        should_retry: shouldRetry,
        original_error: error.message,
        method: 'firebase_admin_sdk'
      };
    }
  }

  /**
   * Отправить уведомления множеству устройств (последовательно)
   */
  public async sendToMultipleTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Firebase Admin SDK не инициализирован');
    }

    if (tokens.length === 0) {
      return {
        success: false,
        error: 'Список токенов пуст'
      };
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const token of tokens) {
      try {
        const result = await this.sendNotification(token, title, body, data);
        results.push({
          token: token,
          ...result
        });
        
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error: any) {
        results.push({
          token: token,
          success: false,
          error: error.message
        });
        failureCount++;
      }
    }

    return {
      success: true,
      success_count: successCount,
      failure_count: failureCount,
      total_count: tokens.length,
      results: results,
      method: 'firebase_admin_sdk_sequential'
    };
  }

  /**
   * Проверить валидность FCM токена (упрощенная версия)
   */
  public async validateToken(token: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Попытка отправить тестовое уведомление с минимальными данными
      const result = await this.sendNotification(token, 'Test', 'Validation test', { test: 'true' });
      return result.success;
    } catch (error: any) {
      console.error('Токен невалиден:', error.message);
      return false;
    }
  }

  /**
   * Валидация FCM токена без отправки сообщения
   */
  public async validateTokenFormat(token: string): Promise<{ valid: boolean; reason?: string }> {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Токен должен быть строкой' };
    }

    if (token.trim().length === 0) {
      return { valid: false, reason: 'Токен не может быть пустым' };
    }

    // Базовая проверка формата FCM токена
    // FCM токены обычно содержат буквы, цифры, дефисы и подчеркивания
    const fcmTokenPattern = /^[a-zA-Z0-9_-]+$/;
    if (!fcmTokenPattern.test(token)) {
      return { valid: false, reason: 'Неверный формат токена' };
    }

    // Проверка длины (FCM токены обычно довольно длинные)
    if (token.length < 50) {
      return { valid: false, reason: 'Токен слишком короткий' };
    }

    return { valid: true };
  }

  /**
   * Очистить недействительные FCM токены из базы данных
   */
  public async cleanupInvalidTokens(): Promise<{ removed: number; checked: number }> {
    if (!this.isInitialized) {
      throw new Error('Firebase Admin SDK не инициализирован');
    }

    // Здесь можно добавить логику для проверки всех токенов в базе
    // и удаления недействительных
    console.log('Cleanup invalid tokens - функция для будущей реализации');
    
    return { removed: 0, checked: 0 };
  }

  /**
   * Получить информацию о Firebase проекте
   */
  public getProjectInfo(): any {
    if (!this.isInitialized) {
      return null;
    }

    const app = admin.app();
    return {
      project_id: app.options.projectId,
      initialized: this.isInitialized,
      service_account_email: process.env.FIREBASE_CLIENT_EMAIL
    };
  }
}

export default FirebaseAdminService;

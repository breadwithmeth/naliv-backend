import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    user_id: number;
    login: string;
  };
}

interface HalykTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface CardSaveRequest {
  invoiceId: string;
  backLink: string;
  failureBackLink: string;
  postLink: string;
  description?: string;
  language?: 'rus' | 'kaz' | 'eng';
}

interface HalykPostLinkResponse {
  accountId: string;
  amount: number;
  approvalCode: string;
  cardId: string;
  cardMask: string;
  cardType: string;
  code: 'ok' | 'error';
  currency: string;
  dateTime: string;
  description: string;
  email: string;
  id: string;
  invoiceId: string;
  ip: string;
  ipCity: string;
  ipCountry: string;
  ipDistrict: string;
  ipLatitude: number;
  ipLongitude: number;
  ipRegion: string;
  issuer: string;
  language: string;
  name: string;
  phone: string;
  reason: string;
  reasonCode: number;
  reference: string;
  secret_hash: string;
  secure: string;
  secureDetails: string;
  terminal: string;
}

export class PaymentController {
  /**
   * Получить все доступные методы оплаты
   * GET /api/payments/methods
   */
  static async getPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentMethods = await prisma.payment_types.findMany({
        orderBy: { payment_type_id: 'asc' }
      });

      res.json({
        success: true,
        data: paymentMethods,
        message: 'Методы оплаты получены успешно'
      });

    } catch (error: any) {
      console.error('Ошибка получения методов оплаты:', error);
      next(createError(500, `Ошибка получения методов оплаты: ${error.message}`));
    }
  }

  /**
   * Получить конкретный метод оплаты по ID
   * GET /api/payments/methods/:id
   */
  static async getPaymentMethodById(req: Request, res: Response, next: NextFunction) {
    try {
      const paymentTypeId = parseInt(req.params.id);

      if (isNaN(paymentTypeId)) {
        return next(createError(400, 'Некорректный ID метода оплаты'));
      }

      const paymentMethod = await prisma.payment_types.findUnique({
        where: { payment_type_id: paymentTypeId }
      });

      if (!paymentMethod) {
        return next(createError(404, 'Метод оплаты не найден'));
      }

      res.json({
        success: true,
        data: paymentMethod,
        message: 'Метод оплаты найден'
      });

    } catch (error: any) {
      console.error('Ошибка получения метода оплаты:', error);
      next(createError(500, `Ошибка получения метода оплаты: ${error.message}`));
    }
  }

  /**
   * Получить только активные методы оплаты (in_app = 1)
   * GET /api/payments/methods/active
   */
  static async getActivePaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      const activePaymentMethods = await prisma.payment_types.findMany({
        where: { in_app: 1 },
        orderBy: { payment_type_id: 'asc' }
      });

      res.json({
        success: true,
        data: activePaymentMethods,
        message: 'Активные методы оплаты получены успешно'
      });

    } catch (error: any) {
      console.error('Ошибка получения активных методов оплаты:', error);
      next(createError(500, `Ошибка получения активных методов оплаты: ${error.message}`));
    }
  }

  /**
   * Генерация уникального invoiceId для сохранения карт
   */
  private static generateCardInvoiceId(userId: number, isRefresh: boolean = false): string {
    // Используем полный timestamp с секундами для максимальной уникальности
    const now = new Date();
    const timestamp = Math.floor(now.getTime() / 1000); // Unix timestamp в секундах
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0'); // миллисекунды
    
    const userPart = userId.toString().padStart(3, '0').slice(-3); // Последние 3 цифры user_id
    const randomPart = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 2 случайные цифры
    const refreshFlag = isRefresh ? '1' : '0'; // 1 цифра для флага обновления
    
    // Формат: CARD + timestamp(10) + milliseconds(3) + user(3) + random(2) + refresh(1) = 24 символа
    const invoiceId = `CARD${timestamp}${milliseconds}${userPart}${randomPart}${refreshFlag}`;
    
    // Ограничиваем до 20 символов для совместимости с Halyk Bank, но сохраняем секунды
    // Берем CARD + timestamp(10) + user(3) + random(2) + refresh(1) = 20 символов
    return `CARD${timestamp}${userPart}${randomPart}${refreshFlag}`;
  }

  /**
   * Проверка уникальности и генерация invoiceId с повторными попытками
   */
  public static async generateUniqueCardInvoiceId(userId: number, isRefresh: boolean = false): Promise<string> {
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const invoiceId = PaymentController.generateCardInvoiceId(userId, isRefresh);
      
      try {
        // Проверяем уникальность в базе данных по таблице заказов
        const existingOrder = await prisma.orders.findFirst({
          where: { order_uuid: invoiceId }
        });

        // Проверяем в таблице сохраненных карт
        const existingCard = await prisma.halyk_saved_cards.findFirst({
          where: { 
            OR: [
              { halyk_card_id: invoiceId },
              // Можно добавить дополнительные проверки если нужно
            ]
          }
        });

        if (!existingOrder && !existingCard) {
          console.log(`Сгенерирован уникальный invoiceId: ${invoiceId} (попытка ${attempts + 1})`);
          return invoiceId;
        }

        console.log(`InvoiceId ${invoiceId} уже существует, генерируем новый (попытка ${attempts + 1})`);
        attempts++;
        
        // Небольшая задержка между попытками
        await new Promise(resolve => setTimeout(resolve, 10));
        
      } catch (error) {
        console.error('Ошибка проверки уникальности invoiceId:', error);
        attempts++;
      }
    }

    // Если не удалось сгенерировать уникальный ID за максимальное количество попыток
    // Используем более длинный UUID как fallback
    const fallbackId = `CARD${Date.now()}${Math.random().toString(36).substring(2)}`.slice(0, 20);
    console.warn(`Использован fallback invoiceId: ${fallbackId} после ${maxAttempts} попыток`);
    return fallbackId;
  }

  /**
   * Получить токен для работы с Halyk Bank
   * @param amount - сумма платежа
   * @param orderUuid - UUID заказа/invoice
   * @param currency - валюта ('USD' для верификации карт, 'KZT' для обычных платежей)
   * @param postLink - ссылка для уведомлений об успешной оплате
   * @param failurePostLink - ссылка для уведомлений о неудачной оплате
   */
  public static async getHalykToken(
    amount: string = '0', 
    orderUuid?: string, 
    currency: string = 'USD',
    postLink?: string,
    failurePostLink?: string
  ): Promise<HalykTokenResponse> {
    const tokenUrl = 'https://epay-oauth.homebank.kz/oauth2/token';
    
    // Параметры из предоставленного PHP кода
    const clientId = 'NALIV.KZ';
    const clientSecret = 'B5Y56*Hw9hxcvwwY';
    const terminalId = 'bb4dec49-6e30-41d0-b16b-8ba1831a854b';

    const formData = new URLSearchParams();
    formData.append('grant_type', 'client_credentials');
    formData.append('scope', 'webapi usermanagement email_send verification statement statistics payment');
    formData.append('client_id', clientId);
    formData.append('client_secret', clientSecret);
    if (orderUuid) {
      formData.append('invoiceID', orderUuid);
    }
    formData.append('amount', amount);
    formData.append('currency', currency);
    formData.append('terminal', terminalId);
    
    // Добавляем postLink параметры согласно документации для сохраненных карт
    if (postLink) {
      formData.append('postLink', postLink);
    }
    if (failurePostLink) {
      formData.append('failurePostLink', failurePostLink);
    }

    console.log('Запрос токена Halyk Bank:', {
      url: tokenUrl,
      orderUuid,
      amount,
      currency, // ✅ Логируем валюту
      timestamp: new Date().toISOString()
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Halyk token response error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          currency, // ✅ Логируем валюту при ошибке
          timestamp: new Date().toISOString()
        });
        throw new Error(`Failed to get token: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const tokenData = await response.json() as HalykTokenResponse;
      
      if (!tokenData.access_token) {
        console.error('Halyk token response missing access_token:', tokenData);
        throw new Error('Получен ответ без токена доступа');
      }

      console.log('Токен Halyk Bank получен успешно:', {
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
        currency, // ✅ Логируем валюту при успехе
        timestamp: new Date().toISOString()
      });

      return tokenData; // ✅ Возвращаем полный ответ
    } catch (error: any) {
      console.error('Ошибка получения токена Halyk:', error);
      throw new Error(`Не удалось получить токен авторизации: ${error.message}`);
    }
  }

  /**
   * Обновить токен и повторить инициализацию сохранения карты
   * POST /api/payments/save-card/refresh-init
   */
  static async refreshCardSaveInit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const userId = req.user.user_id;
      const {
        backLink,
        failureBackLink,
        postLink,
        description = 'Регистрация карты (обновлено)',
        language = 'rus'
      }: CardSaveRequest = req.body;

      // Валидация обязательных полей
      if (!backLink || !failureBackLink || !postLink) {
        return next(createError(400, 'Необходимо указать backLink, failureBackLink и postLink'));
      }

      // Генерируем новый уникальный invoiceId с проверкой в БД
      const invoiceId = await PaymentController.generateUniqueCardInvoiceId(userId, true);

      try {
        console.log('Обновление инициализации сохранения карты:', {
          userId,
          invoiceId,
          timestamp: new Date().toISOString()
        });

        // Получаем новый токен от Halyk Bank с USD для верификации карт
        const authToken = await PaymentController.getHalykToken('0', invoiceId, 'USD');

        // Настройки для production API
        const jsLibraryUrl = 'https://epay.homebank.kz/payform/payment-api.js';
        const terminalId = 'bb4dec49-6e30-41d0-b16b-8ba1831a854b';

        // Создаем объект платежа для фронтенда с обновленными данными
        const paymentObject = {
          invoiceId: invoiceId,
          backLink: backLink,
          failureBackLink: failureBackLink,
          postLink: postLink,
          language: language,
          description: description,
          accountId: userId.toString(),
          terminal: terminalId,
          amount: 0,
          currency: 'USD', // ✅ Используем USD как в PHP коде
          cardSave: true,
          paymentType: 'cardVerification',
          auth: authToken,
          timestamp: Date.now() // Добавляем timestamp для отслеживания
        };

        res.json({
          success: true,
          data: {
            paymentObject,
            jsLibraryUrl,
            invoiceId,
            refreshed: true,
            instructions: {
              frontend: "Токен обновлен. Подключите JS-библиотеку и вызовите halyk.pay(paymentObject)",
              jsLibrary: jsLibraryUrl,
              method: "halyk.pay()",
              note: "Это обновленная сессия с новым токеном"
            }
          },
          message: 'Токен обновлен, готов для сохранения карты'
        });

      } catch (tokenError: any) {
        console.error('Ошибка обновления токена:', tokenError);
        return next(createError(500, `Не удалось обновить токен: ${tokenError.message}`));
      }

    } catch (error: any) {
      console.error('Ошибка обновления инициализации сохранения карты:', error);
      next(createError(500, `Ошибка обновления: ${error.message}`));
    }
  }

  /**
   * Инициализация сохранения карты
   * POST /api/payments/save-card/init
   */
  static async initCardSave(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const userId = req.user.user_id;
      const {
        backLink,
        failureBackLink,
        postLink,
        description = 'Регистрация карты',
        language = 'rus'
      }: CardSaveRequest = req.body;

      // Валидация обязательных полей
      if (!backLink || !failureBackLink || !postLink) {
        return next(createError(400, 'Необходимо указать backLink, failureBackLink и postLink'));
      }

      // Генерируем уникальный invoiceId с проверкой в БД
      const invoiceId = await PaymentController.generateUniqueCardInvoiceId(userId, false);

      console.log('Сгенерирован invoiceId для инициализации:', {
        invoiceId,
        userId,
        isRefresh: false,
        timestamp: new Date().toISOString()
      });

      try {
        // Получаем токен от Halyk Bank с USD для регистрации карты (как в PHP)
        const authToken = await PaymentController.getHalykToken('0', invoiceId, 'USD');

        // Настройки для production API (как в PHP коде)
        const jsLibraryUrl = 'https://epay.homebank.kz/payform/payment-api.js';
        const terminalId = 'bb4dec49-6e30-41d0-b16b-8ba1831a854b';

        // Создаем объект платежа для фронтенда
        const paymentObject = {
          invoiceId: invoiceId,
          backLink: backLink,
          failureBackLink: failureBackLink,
          postLink: postLink,
          language: language,
          description: description,
          accountId: userId.toString(), // ID пользователя как accountId
          terminal: terminalId,
          amount: 0, // Для сохранения карты всегда 0
          currency: 'USD', // ✅ Используем USD как в PHP коде для верификации
          cardSave: true,
          paymentType: 'cardVerification'
        };

        // Возвращаем полный HTML ответ
        const htmlResponse = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Card Verification</title>
    <script src="${jsLibraryUrl}"></script>
</head>
<body>
    
</body>
<script>
    var createPaymentObject = function(auth, invoiceId, amount) {
        var paymentObject = {
            invoiceId: invoiceId,
            backLink: "${backLink}",
            failureBackLink: "${failureBackLink}",
            postLink: "${postLink}",
            language: "${language}",
            description: "${description}",
            accountId: "${userId}",
            terminal: "${terminalId}",
            amount: amount,
            currency: "USD",
            cardSave: true,
            paymentType: "cardVerification" 
        };
        paymentObject.auth = auth;
        return paymentObject; 
    };

    halyk.cardverification(createPaymentObject(${JSON.stringify(authToken)}, "${invoiceId}", '0'));
</script>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(htmlResponse);

      } catch (tokenError: any) {
        console.error('Ошибка при работе с Halyk API:', tokenError);
        return next(createError(500, `Ошибка платежной системы: ${tokenError.message}`));
      }

    } catch (error: any) {
      console.error('Ошибка инициализации сохранения карты:', error);
      next(createError(500, `Ошибка инициализации: ${error.message}`));
    }
  }

  /**
   * Обработка PostLink от Halyk Bank
   * POST /api/payments/save-card/postlink
   */
  static async handleCardSavePostLink(req: Request, res: Response, next: NextFunction) {
    try {
      const postLinkData: HalykPostLinkResponse = req.body;

      console.log('Получен PostLink от Halyk Bank:', JSON.stringify(postLinkData, null, 2));

      // Валидация обязательных полей
      if (!postLinkData.accountId || !postLinkData.invoiceId) {
        return next(createError(400, 'Неверные данные PostLink'));
      }

      const userId = parseInt(postLinkData.accountId);
      
      if (isNaN(userId)) {
        return next(createError(400, 'Неверный accountId'));
      }

      if (postLinkData.code === 'ok' && postLinkData.cardId && postLinkData.cardMask) {
        // Сохраняем карту в базе данных
        try {
          await prisma.halyk_saved_cards.create({
            data: {
              user_id: userId,
              card_mask: postLinkData.cardMask,
              halyk_card_id: postLinkData.cardId
            }
          });

          console.log(`Карта успешно сохранена для пользователя ${userId}: ${postLinkData.cardMask}`);
        } catch (dbError: any) {
          console.error('Ошибка сохранения карты в БД:', dbError);
          // Не возвращаем ошибку, так как это может быть дублирование
        }
      }

      // Всегда возвращаем успех для PostLink
      res.status(200).json({
        success: true,
        message: 'PostLink обработан'
      });

    } catch (error: any) {
      console.error('Ошибка обработки PostLink:', error);
      // Даже при ошибке возвращаем 200 для PostLink
      res.status(200).json({
        success: false,
        message: 'Ошибка обработки PostLink'
      });
    }
  }

  /**
   * Тестовый endpoint для получения свежих данных без авторизации
   * POST /api/payments/save-card/test-init
   */
  static async testCardSaveInit(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        userId = 252, 
        amount = 0, 
        invoiceId 
      } = req.body;

      let finalInvoiceId = invoiceId;
      
      // Если invoiceId не передан, генерируем новый
      if (!finalInvoiceId) {
        finalInvoiceId = await PaymentController.generateUniqueCardInvoiceId(userId, false);
      }

      console.log('Тестовая инициализация сохранения карты:', {
        userId,
        invoiceId: finalInvoiceId,
        amount,
        timestamp: new Date().toISOString()
      });

      try {
        // Получаем токен от Halyk Bank с USD для верификации карт
        const authToken = await PaymentController.getHalykToken(amount.toString(), finalInvoiceId, 'USD');

        res.json({
          success: true,
          data: {
            auth: authToken,
            invoiceId: finalInvoiceId,
            amount,
            userId,
            currency: 'USD', // ✅ Указываем валюту
            timestamp: Date.now()
          },
          message: 'Тестовый токен получен успешно (USD)'
        });

      } catch (tokenError: any) {
        console.error('Ошибка получения тестового токена:', tokenError);
        return next(createError(500, `Ошибка получения токена: ${tokenError.message}`));
      }

    } catch (error: any) {
      console.error('Ошибка тестовой инициализации:', error);
      next(createError(500, `Ошибка тестовой инициализации: ${error.message}`));
    }
  }

  /**
   * Тестовый endpoint для генерации множественных Invoice ID
   * POST /api/payments/test-invoice-generation
   */
  static async testInvoiceGeneration(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId = 252, count = 5 } = req.body;

      console.log(`Генерация ${count} тестовых Invoice ID для пользователя ${userId}`);

      const generatedIds: string[] = [];
      const errors: string[] = [];

      for (let i = 0; i < count; i++) {
        try {
          const invoiceId = await PaymentController.generateUniqueCardInvoiceId(userId, false);
          generatedIds.push(invoiceId);
          
          // Небольшая задержка между генерациями
          await new Promise(resolve => setTimeout(resolve, 5));
        } catch (error: any) {
          errors.push(`Ошибка ${i + 1}: ${error.message}`);
        }
      }

      // Проверяем уникальность сгенерированных ID
      const uniqueIds = [...new Set(generatedIds)];
      const hasDuplicates = uniqueIds.length !== generatedIds.length;

      res.json({
        success: true,
        data: {
          generatedIds,
          totalGenerated: generatedIds.length,
          uniqueCount: uniqueIds.length,
          allUnique: !hasDuplicates,
          errors: errors.length > 0 ? errors : undefined,
          userId,
          timestamp: Date.now()
        },
        message: `Сгенерировано ${generatedIds.length} Invoice ID (${uniqueIds.length} уникальных)`
      });

    } catch (error: any) {
      console.error('Ошибка тестовой генерации Invoice ID:', error);
      next(createError(500, `Ошибка генерации: ${error.message}`));
    }
  }

  /**
   * Получить статус платежа и обработать ошибки
   * POST /api/payments/status
   */
  static async getPaymentStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const { invoiceId, error, errorMessage } = req.body;

      if (!invoiceId) {
        return next(createError(400, 'Необходимо указать invoiceId'));
      }

      console.log('Статус платежа:', {
        invoiceId,
        error,
        errorMessage,
        userId: req.user.user_id,
        timestamp: new Date().toISOString()
      });

      // Обрабатываем различные типы ошибок
      let responseData: any = {
        invoiceId,
        status: 'error',
        canRetry: true
      };

      if (error || errorMessage) {
        // Определяем тип ошибки и даем рекомендации
        const errorText = errorMessage || error || '';
        
        if (errorText.includes('время') || errorText.includes('истекло') || errorText.includes('timeout')) {
          responseData = {
            ...responseData,
            errorType: 'timeout',
            userMessage: 'Время сеанса истекло. Попробуйте создать новую сессию.',
            recommendation: 'refresh_token',
            canRetry: true
          };
        } else if (errorText.includes('отменен') || errorText.includes('cancel')) {
          responseData = {
            ...responseData,
            errorType: 'cancelled',
            userMessage: 'Платеж был отменен пользователем.',
            recommendation: 'user_cancelled',
            canRetry: true
          };
        } else if (errorText.includes('карта') || errorText.includes('card')) {
          responseData = {
            ...responseData,
            errorType: 'card_error',
            userMessage: 'Ошибка при работе с картой. Проверьте данные карты.',
            recommendation: 'check_card_data',
            canRetry: true
          };
        } else {
          responseData = {
            ...responseData,
            errorType: 'unknown',
            userMessage: 'Произошла неизвестная ошибка. Попробуйте еще раз.',
            recommendation: 'retry',
            canRetry: true
          };
        }
      } else {
        responseData = {
          invoiceId,
          status: 'success',
          userMessage: 'Статус платежа проверяется...'
        };
      }

      res.json({
        success: true,
        data: responseData,
        message: 'Статус платежа обработан'
      });

    } catch (error: any) {
      console.error('Ошибка получения статуса платежа:', error);
      next(createError(500, `Ошибка получения статуса: ${error.message}`));
    }
  }

  /**
   * Создание заказа с оплатой - интеграция с OrderController
   * POST /api/payments/create-order-with-payment
   */
  static async createOrderWithPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const {
        business_id,
        address_id,
        items,
        bonus = 0,
        extra,
        delivery_type,
        delivery_date,
        payment_method = 'card', // 'card' или 'saved_card'
        saved_card_id, // ID сохраненной карты (если payment_method = 'saved_card')
        backLink = "http://localhost:3000/api/payments/success",
        failureBackLink = "http://localhost:3000/api/payments/failure",
        postLink = "http://localhost:3000/api/payments/webhook"
      } = req.body;

      const userId = req.user.user_id;

      // Валидация обязательных полей
      if (!business_id || !items || items.length === 0 || !delivery_type) {
        return next(createError(400, 'Не указаны обязательные поля: business_id, items, delivery_type'));
      }

      // Импортируем OrderController для создания заказа
      const { OrderController } = require('./orderController');

      // Создаем временный request объект для OrderController
      const orderRequest = {
        ...req,
        body: {
          business_id,
          address_id,
          items,
          bonus,
          extra,
          delivery_type,
          delivery_date
        }
      } as any;

      // Создаем заказ через существующий метод
      let orderData: any;
      let totalCost: number;

      try {
        // Создаем заказ через OrderController.createUserOrder
        await OrderController.createUserOrder(orderRequest, {
          status: (code: number) => ({ json: (data: any) => { orderData = data; } }),
          json: (data: any) => { orderData = data; }
        } as any, (error: any) => { throw error; });

        if (!orderData || !orderData.success) {
          throw new Error('Не удалось создать заказ');
        }

        totalCost = orderData.data.total_cost;

        console.log('Заказ создан успешно:', {
          order_id: orderData.data.order_id,
          order_uuid: orderData.data.order_uuid,
          total_cost: totalCost,
          timestamp: new Date().toISOString()
        });

      } catch (orderError: any) {
        console.error('Ошибка создания заказа:', orderError);
        return next(createError(500, `Ошибка создания заказа: ${orderError.message}`));
      }

      // Генерируем уникальный invoice ID для платежа
      const paymentInvoiceId = await PaymentController.generateUniqueCardInvoiceId(userId, false);

      console.log('Создание платежа для заказа:', {
        order_id: orderData.data.order_id,
        order_uuid: orderData.data.order_uuid,
        payment_invoice_id: paymentInvoiceId,
        total_cost: totalCost,
        payment_method,
        saved_card_id: saved_card_id || null,
        timestamp: new Date().toISOString()
      });

      // Получаем токен от Halyk Bank для платежа
      const authToken = await PaymentController.getHalykToken(totalCost.toString(), paymentInvoiceId, 'KZT');

      // Настройки для платежа
      const jsLibraryUrl = 'https://epay.homebank.kz/payform/payment-api.js';
      const terminalId = 'bb4dec49-6e30-41d0-b16b-8ba1831a854b';

      // Если используется сохраненная карта, получаем её данные
      let savedCardData = null;
      if (payment_method === 'saved_card' && saved_card_id) {
        savedCardData = await prisma.halyk_saved_cards.findFirst({
          where: {
            card_id: saved_card_id,
            user_id: userId
          }
        });

        if (!savedCardData) {
          return next(createError(404, 'Сохраненная карта не найдена'));
        }
      }

      // Возвращаем полный HTML ответ для оплаты
      const htmlResponse = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Processing</title>
    <script src="${jsLibraryUrl}"></script>
</head>
<body>
    <div style="text-align: center; padding: 20px;">
        <h2>Обработка платежа</h2>
        <p>Сумма к оплате: ${totalCost} ₸</p>
        <p>Заказ №${orderData.data.order_uuid}</p>
        <div id="status">Инициализация платежа...</div>
    </div>
</body>
<script>
    var createPaymentObject = function(auth, invoiceId, amount) {
        var paymentObject = {
            invoiceId: invoiceId,
            backLink: "${backLink}",
            failureBackLink: "${failureBackLink}",
            postLink: "${postLink}",
            language: "rus",
            description: "Оплата заказа №${orderData.data.order_uuid}",
            accountId: "${userId}",
            terminal: "${terminalId}",
            amount: amount,
            currency: "KZT",
            cardSave: false,
            paymentType: "payment"${savedCardData ? `,
            cardId: "${savedCardData.halyk_card_id}"` : ''}
        };
        paymentObject.auth = auth;
        return paymentObject; 
    };

    // Обновляем статус
    document.getElementById('status').innerHTML = 'Перенаправление на платежную систему...';

    ${payment_method === 'saved_card' && savedCardData ? 
      `halyk.pay(createPaymentObject(${JSON.stringify(authToken)}, "${paymentInvoiceId}", "${totalCost}"));` :
      `halyk.pay(createPaymentObject(${JSON.stringify(authToken)}, "${paymentInvoiceId}", "${totalCost}"));`
    }
</script>
</html>`;

      // Сохраняем связь платежа с заказом в базе данных
      await prisma.orders.update({
        where: { order_id: orderData.data.order_id },
        data: {
          extra: JSON.stringify({
            payment_invoice_id: paymentInvoiceId,
            payment_method,
            saved_card_id: saved_card_id || null,
            original_extra: extra
          })
        }
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlResponse);

    } catch (error: any) {
      console.error('Ошибка создания заказа с оплатой:', error);
      next(createError(500, `Ошибка создания заказа с оплатой: ${error.message}`));
    }
  }

  /**
   * Оплата заказа сохраненной картой
   * POST /api/payments/pay-with-saved-card
   */
  static async payWithSavedCard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const {
        order_id,
        saved_card_id,
        backLink = "http://localhost:3000/api/payments/success",
        failureBackLink = "http://localhost:3000/api/payments/failure",
        postLink = "http://localhost:3000/api/payments/webhook"
      } = req.body;

      const userId = req.user.user_id;

      // Валидация обязательных полей
      if (!order_id || !saved_card_id) {
        return next(createError(400, 'Не указаны обязательные поля: order_id, saved_card_id'));
      }

      // Проверяем существование заказа и права доступа
      const order = await prisma.orders.findUnique({
        where: { order_id: order_id }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      if (order.user_id !== userId) {
        return next(createError(403, 'Доступ к заказу запрещен'));
      }

      // Проверяем, что заказ не оплачен
      const orderStatus = await prisma.order_status.findFirst({
        where: { order_id: order_id },
        orderBy: { log_timestamp: 'desc' }
      });

      if (orderStatus && orderStatus.status >= 2) { // 2 = PAID
        return next(createError(400, 'Заказ уже оплачен'));
      }

      // Проверяем существование сохраненной карты и права доступа
      const savedCard = await prisma.halyk_saved_cards.findFirst({
        where: {
          card_id: saved_card_id,
          user_id: userId
        }
      });

      if (!savedCard) {
        return next(createError(404, 'Сохраненная карта не найдена или не принадлежит пользователю'));
      }

      // Получаем стоимость заказа
      const orderCost = await prisma.orders_cost.findFirst({
        where: { order_id: order_id }
      });

      if (!orderCost) {
        return next(createError(404, 'Стоимость заказа не найдена'));
      }

      const totalAmount = Number(orderCost.cost);

      // Генерируем уникальный invoice ID для платежа
      const paymentInvoiceId = await PaymentController.generateUniqueCardInvoiceId(userId, false);

      console.log('Оплата заказа сохраненной картой:', {
        order_id: order.order_id,
        order_uuid: order.order_uuid,
        payment_invoice_id: paymentInvoiceId,
        total_amount: totalAmount,
        saved_card_id: saved_card_id,
        card_mask: savedCard.card_mask,
        halyk_card_id: savedCard.halyk_card_id,
        timestamp: new Date().toISOString()
      });

      // Получаем токен от Halyk Bank для платежа (KZT для обычного платежа)
      const authToken = await PaymentController.getHalykToken(totalAmount.toString(), paymentInvoiceId, 'KZT');

      // Настройки для платежа
      const jsLibraryUrl = 'https://epay.homebank.kz/payform/payment-api.js';
      const terminalId = 'bb4dec49-6e30-41d0-b16b-8ba1831a854b';

      // Сохраняем связь платежа с заказом
      const currentExtra = order.extra ? JSON.parse(order.extra) : {};
      currentExtra.payment_info = {
        payment_invoice_id: paymentInvoiceId,
        payment_method: 'saved_card',
        saved_card_id: saved_card_id,
        card_mask: savedCard.card_mask,
        halyk_card_id: savedCard.halyk_card_id,
        payment_start_time: new Date().toISOString()
      };

      await prisma.orders.update({
        where: { order_id: order_id },
        data: {
          extra: JSON.stringify(currentExtra)
        }
      });

      // Возвращаем полный HTML ответ для оплаты сохраненной картой
      const htmlResponse = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment with Saved Card</title>
    <script src="${jsLibraryUrl}"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
            background: #f8f9fa;
        }
        .payment-container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .card-info {
            background: #e8f4fd;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #007bff;
        }
        .order-info {
            background: #fff3cd;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #ffc107;
        }
        .status {
            margin: 20px 0;
            font-size: 16px;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="payment-container">
        <h2>Оплата заказа сохраненной картой</h2>
        
        <div class="order-info">
            <h4>Информация о заказе:</h4>
            <p><strong>Номер заказа:</strong> ${order.order_uuid}</p>
            <p><strong>Сумма к оплате:</strong> ${totalAmount} ₸</p>
        </div>
        
        <div class="card-info">
            <h4>Карта для оплаты:</h4>
            <p><strong>Номер карты:</strong> **** **** **** ${savedCard.card_mask.slice(-4)}</p>
            <p><strong>Тип платежа:</strong> Оплата сохраненной картой</p>
        </div>
        
        <div class="status" id="status">Инициализация платежа...</div>
    </div>
</body>
<script>
    var createPaymentObject = function(auth, invoiceId, amount, cardId) {
        var paymentObject = {
            invoiceId: invoiceId,
            backLink: "${backLink}",
            failureBackLink: "${failureBackLink}",
            postLink: "${postLink}",
            language: "rus",
            description: "Оплата заказа №${order.order_uuid}",
            accountId: "${userId}",
            terminal: "${terminalId}",
            amount: amount,
            currency: "KZT",
            cardSave: false,
            paymentType: "payment",
            cardId: cardId  // Используем сохраненную карту
        };
        paymentObject.auth = auth;
        return paymentObject; 
    };

    // Обновляем статус
    document.getElementById('status').innerHTML = 'Перенаправление на платежную систему...';

    // Инициализируем платеж с сохраненной картой
    halyk.pay(createPaymentObject(
        ${JSON.stringify(authToken)}, 
        "${paymentInvoiceId}", 
        "${totalAmount}",
        "${savedCard.halyk_card_id}"
    ));
</script>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlResponse);

    } catch (error: any) {
      console.error('Ошибка оплаты заказа сохраненной картой:', error);
      next(createError(500, `Ошибка оплаты сохраненной картой: ${error.message}`));
    }
  }

  /**
   * Получить статус заказа и связанного платежа
   * GET /api/payments/order-payment-status/:orderId
   */
  static async getOrderPaymentStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Проверяем авторизацию пользователя
      if (!req.user) {
        return next(createError(401, 'Необходима авторизация'));
      }

      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) {
        return next(createError(400, 'Некорректный ID заказа'));
      }

      // Получаем заказ
      const order = await prisma.orders.findUnique({
        where: { order_id: orderId }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Проверяем права доступа
      if (order.user_id !== req.user.user_id) {
        return next(createError(403, 'Доступ запрещен'));
      }

      // Получаем последний статус заказа
      const orderStatus = await prisma.order_status.findFirst({
        where: { order_id: orderId },
        orderBy: { log_timestamp: 'desc' }
      });

      // Получаем стоимость заказа
      const orderCost = await prisma.orders_cost.findFirst({
        where: { order_id: orderId }
      });

      // Извлекаем информацию о платеже из поля extra
      let paymentInfo = null;
      if (order.extra) {
        try {
          const extraData = JSON.parse(order.extra);
          paymentInfo = {
            payment_invoice_id: extraData.payment_invoice_id,
            payment_method: extraData.payment_method,
            saved_card_id: extraData.saved_card_id
          };
        } catch (e) {
          console.log('Не удалось распарсить extra данные заказа:', e);
        }
      }

      res.json({
        success: true,
        data: {
          order: {
            order_id: order.order_id,
            order_uuid: order.order_uuid,
            status: orderStatus?.status,
            is_canceled: order.is_canceled,
            created_at: order.log_timestamp,
            delivery_type: order.delivery_type,
            delivery_date: order.delivery_date
          },
          cost: orderCost ? {
            total: Number(orderCost.cost),
            delivery: Number(orderCost.delivery),
            service_fee: Number(orderCost.service_fee)
          } : null,
          payment: paymentInfo
        },
        message: 'Статус заказа и платежа получен'
      });

    } catch (error: any) {
      console.error('Ошибка получения статуса заказа и платежа:', error);
      next(createError(500, `Ошибка получения статуса: ${error.message}`));
    }
  }

  /**
   * Обработка успешной оплаты (backLink)
   * GET /api/payments/success
   */
  static async handlePaymentSuccess(req: Request, res: Response, next: NextFunction) {
    try {
      const { invoiceId, orderId, amount, cardMask } = req.query;

      console.log('Успешная оплата:', {
        invoiceId,
        orderId,
        amount,
        cardMask,
        timestamp: new Date().toISOString()
      });

      // Если есть invoiceId, ищем заказ по нему
      let order = null;
      if (invoiceId) {
        const orders = await prisma.orders.findMany({
          where: {
            extra: {
              contains: `"payment_invoice_id":"${invoiceId}"`
            }
          }
        });
        order = orders[0] || null;
      }

      // Возвращаем HTML страницу с информацией об успешной оплате
      const htmlResponse = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Оплата прошла успешно</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
            background: #f8f9fa;
        }
        .success-container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .success-icon {
            font-size: 64px;
            color: #28a745;
            margin-bottom: 20px;
        }
        .order-info {
            background: #e8f5e8;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: left;
        }
        .btn {
            background: #007bff;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            text-decoration: none;
            display: inline-block;
            margin: 10px;
            cursor: pointer;
        }
        .btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="success-container">
        <div class="success-icon">✅</div>
        <h1>Оплата прошла успешно!</h1>
        <p>Спасибо за покупку. Ваш платеж обработан.</p>
        
        ${order ? `
        <div class="order-info">
            <h3>Информация о заказе:</h3>
            <p><strong>Номер заказа:</strong> ${order.order_uuid}</p>
            <p><strong>Сумма:</strong> ${amount || 'Не указана'} ₸</p>
            <p><strong>Статус:</strong> Оплачен</p>
            <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        </div>
        ` : `
        <div class="order-info">
            <h3>Детали платежа:</h3>
            <p><strong>Invoice ID:</strong> ${invoiceId || 'Не указан'}</p>
            <p><strong>Сумма:</strong> ${amount || 'Не указана'} ₸</p>
            <p><strong>Дата:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        </div>
        `}
        
        <div>
            <a href="/" class="btn">На главную</a>
            <a href="/orders" class="btn">Мои заказы</a>
        </div>
        
        <p style="margin-top: 30px; color: #666; font-size: 14px;">
            Вы получите уведомление о статусе заказа на указанный номер телефона.
        </p>
    </div>

    <script>
        // Уведомляем родительское окно об успешной оплате
        if (window.opener) {
            window.opener.postMessage({
                type: 'payment_success',
                invoiceId: '${invoiceId}',
                orderId: '${orderId}',
                amount: '${amount}'
            }, '*');
        }
        
        // Автоматически закрываем окно через 10 секунд
        setTimeout(() => {
            if (window.opener) {
                window.close();
            }
        }, 10000);
    </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlResponse);

    } catch (error: any) {
      console.error('Ошибка обработки успешной оплаты:', error);
      next(createError(500, `Ошибка обработки успешной оплаты: ${error.message}`));
    }
  }

  /**
   * Обработка неудачной оплаты (failureBackLink)  
   * GET /api/payments/failure
   */
  static async handlePaymentFailure(req: Request, res: Response, next: NextFunction) {
    try {
      const { invoiceId, orderId, error: paymentError, errorMessage } = req.query;

      console.log('Неудачная оплата:', {
        invoiceId,
        orderId,
        error: paymentError,
        errorMessage,
        timestamp: new Date().toISOString()
      });

      // Если есть invoiceId, ищем заказ по нему
      let order = null;
      if (invoiceId) {
        const orders = await prisma.orders.findMany({
          where: {
            extra: {
              contains: `"payment_invoice_id":"${invoiceId}"`
            }
          }
        });
        order = orders[0] || null;
      }

      // Возвращаем HTML страницу с информацией о неудачной оплате
      const htmlResponse = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ошибка оплаты</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
            background: #f8f9fa;
        }
        .error-container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .error-icon {
            font-size: 64px;
            color: #dc3545;
            margin-bottom: 20px;
        }
        .error-info {
            background: #f8d7da;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
            text-align: left;
            border: 1px solid #f5c6cb;
        }
        .btn {
            background: #007bff;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            text-decoration: none;
            display: inline-block;
            margin: 10px;
            cursor: pointer;
        }
        .btn:hover {
            background: #0056b3;
        }
        .btn-retry {
            background: #28a745;
        }
        .btn-retry:hover {
            background: #1e7e34;
        }
    </style>
</head>
<body>
    <div class="error-container">
        <div class="error-icon">❌</div>
        <h1>Ошибка при оплате</h1>
        <p>К сожалению, платеж не был завершен. Попробуйте еще раз.</p>
        
        <div class="error-info">
            <h3>Детали ошибки:</h3>
            <p><strong>Код ошибки:</strong> ${paymentError || 'Не указан'}</p>
            <p><strong>Описание:</strong> ${errorMessage || 'Платеж был отменен или произошла техническая ошибка'}</p>
            <p><strong>Invoice ID:</strong> ${invoiceId || 'Не указан'}</p>
            <p><strong>Время:</strong> ${new Date().toLocaleString('ru-RU')}</p>
        </div>
        
        ${order ? `
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
            <p><strong>Внимание!</strong> Ваш заказ ${order.order_uuid} создан, но не оплачен.</p>
            <p>Вы можете попробовать оплатить его позже в разделе "Мои заказы".</p>
        </div>
        ` : ''}
        
        <div>
            <button onclick="retryPayment()" class="btn btn-retry">Попробовать еще раз</button>
            <a href="/" class="btn">На главную</a>
            <a href="/orders" class="btn">Мои заказы</a>
        </div>
        
        <div style="margin-top: 30px; color: #666; font-size: 14px;">
            <p><strong>Возможные причины ошибки:</strong></p>
            <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                <li>Недостаточно средств на карте</li>
                <li>Карта заблокирована банком</li>
                <li>Неверно введены данные карты</li>
                <li>Техническая ошибка платежной системы</li>
            </ul>
        </div>
    </div>

    <script>
        function retryPayment() {
            // Уведомляем родительское окно о необходимости повторить платеж
            if (window.opener) {
                window.opener.postMessage({
                    type: 'payment_retry',
                    invoiceId: '${invoiceId}',
                    orderId: '${orderId}'
                }, '*');
                window.close();
            } else {
                // Если нет родительского окна, перенаправляем на страницу заказа
                window.location.href = '/orders';
            }
        }
        
        // Уведомляем родительское окно об ошибке оплаты
        if (window.opener) {
            window.opener.postMessage({
                type: 'payment_failure',
                invoiceId: '${invoiceId}',
                orderId: '${orderId}',
                error: '${paymentError}',
                errorMessage: '${errorMessage}'
            }, '*');
        }
    </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlResponse);

    } catch (error: any) {
      console.error('Ошибка обработки неудачной оплаты:', error);
      next(createError(500, `Ошибка обработки неудачной оплаты: ${error.message}`));
    }
  }

  /**
   * Webhook для обработки уведомлений от Halyk Bank (postLink)
   * POST /api/payments/webhook
   */
  static async handlePaymentWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const webhookData = req.body;
      
      console.log('Получен webhook от Halyk Bank:', {
        data: webhookData,
        timestamp: new Date().toISOString()
      });

      // Базовая структура ответа для Halyk Bank
      let responseData = {
        status: 'received',
        message: 'Webhook обработан'
      };

      // Обрабатываем разные типы уведомлений
      if (webhookData.invoiceId) {
        const invoiceId = webhookData.invoiceId;
        
        // Ищем заказ по invoice ID
        const orders = await prisma.orders.findMany({
          where: {
            extra: {
              contains: `"payment_invoice_id":"${invoiceId}"`
            }
          }
        });

        if (orders.length > 0) {
          const order = orders[0];
          
          console.log('Найден заказ для webhook:', {
            order_id: order.order_id,
            order_uuid: order.order_uuid,
            invoice_id: invoiceId
          });

          // Обновляем статус заказа в зависимости от статуса платежа
          if (webhookData.status === 'PAID' || webhookData.paymentStatus === 'SUCCESS') {
            // Платеж успешен - обновляем статус заказа
            await prisma.order_status.create({
              data: {
                order_id: order.order_id,
                status: 2, // PAID статус
                isCanceled: 0,
                log_timestamp: new Date()
              }
            });

            // Сохраняем информацию о платеже
            const paymentInfo = {
              invoice_id: invoiceId,
              amount: webhookData.amount,
              currency: webhookData.currency || 'KZT',
              payment_date: new Date().toISOString(),
              card_mask: webhookData.cardMask,
              payment_status: 'SUCCESS',
              webhook_data: webhookData
            };

            // Обновляем extra поле с информацией о платеже
            const currentExtra = order.extra ? JSON.parse(order.extra) : {};
            currentExtra.payment_info = paymentInfo;

            await prisma.orders.update({
              where: { order_id: order.order_id },
              data: {
                extra: JSON.stringify(currentExtra)
              }
            });

            responseData.message = 'Заказ помечен как оплаченный';
            
          } else if (webhookData.status === 'FAILED' || webhookData.paymentStatus === 'FAILED') {
            // Платеж неудачен
            const paymentInfo = {
              invoice_id: invoiceId,
              payment_status: 'FAILED',
              error_code: webhookData.errorCode,
              error_message: webhookData.errorMessage,
              webhook_data: webhookData
            };

            // Обновляем extra поле с информацией об ошибке
            const currentExtra = order.extra ? JSON.parse(order.extra) : {};
            currentExtra.payment_info = paymentInfo;

            await prisma.orders.update({
              where: { order_id: order.order_id },
              data: {
                extra: JSON.stringify(currentExtra)
              }
            });

            responseData.message = 'Информация об ошибке платежа сохранена';
          }
        } else {
          console.log('Заказ не найден для invoice ID:', invoiceId);
          responseData.message = 'Заказ не найден';
        }
      }

      // Возвращаем ответ для Halyk Bank
      res.json(responseData);

    } catch (error: any) {
      console.error('Ошибка обработки webhook:', error);
      
      // Всегда возвращаем успешный ответ Halyk Bank, чтобы избежать повторных вызовов
      res.json({
        status: 'error',
        message: 'Ошибка обработки webhook, но запрос принят'
      });
    }
  }

  /**
   * Оплата существующего заказа сохраненной картой
   */
  public static async payOrderWithSavedCard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { order_id, saved_card_id } = req.body;
      const userId = req.user?.user_id;

      if (!userId) {
        return next(createError(401, 'Пользователь не авторизован'));
      }

      if (!order_id || !saved_card_id) {
        return next(createError(400, 'Не указан ID заказа или ID сохраненной карты'));
      }

      // Проверяем существование заказа и принадлежность пользователю
      const order = await prisma.orders.findFirst({
        where: {
          order_id: order_id,
          user_id: userId
        }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Получаем статус заказа
      const orderStatus = await prisma.order_status.findFirst({
        where: { order_id: order.order_id },
        orderBy: { log_timestamp: 'desc' }
      });

      // Проверяем, что заказ не оплачен (статус 0 = NEW, 66 = UNPAID)
      if (orderStatus && ![0, 66].includes(orderStatus.status)) {
        return next(createError(400, 'Заказ уже оплачен или имеет некорректный статус'));
      }

      // Получаем информацию о бизнесе
      const business = await prisma.businesses.findFirst({
        where: { business_id: order.business_id || 0 }
      });

      // Проверяем существование сохраненной карты
      const savedCard = await prisma.halyk_saved_cards.findFirst({
        where: {
          card_id: saved_card_id,
          user_id: userId
        }
      });

      if (!savedCard) {
        return next(createError(404, 'Сохраненная карта не найдена'));
      }

      // Получаем стоимость заказа
      const orderCost = await prisma.orders_cost.findFirst({
        where: { order_id: parseFloat(order_id.toString()) }
      });

      const totalCost = orderCost ? parseFloat(orderCost.cost.toString()) + parseFloat(orderCost.delivery.toString()) : order.delivery_price;

      if (totalCost <= 0) {
        return next(createError(400, 'Некорректная стоимость заказа'));
      }

      // Получаем токен доступа
      const token = await PaymentController.getHalykToken();
      if (!token) {
        return next(createError(500, 'Не удалось получить токен доступа'));
      }

      // Генерируем уникальный invoice ID для платежа
      const invoiceId = await PaymentController.generateUniqueCardInvoiceId(userId);

      // Данные для создания платежа по сохраненной карте
      const paymentData = {
        amount: Math.round(totalCost * 100), // Конвертируем в тийин (копейки)
        currency: 'KZT',
        invoiceId: invoiceId,
        cardId: savedCard.halyk_card_id,
        description: `Оплата заказа №${order.order_id} в ${business?.name || 'Naliv.kz'}`,
        backLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-success?order_id=${order.order_id}&invoice_id=${invoiceId}`,
        failureBackLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-failure?order_id=${order.order_id}&invoice_id=${invoiceId}`,
        postLink: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payments/payment-webhook`,
        email: '',
        phone: ''
      };

      console.log('Данные для оплаты сохраненной картой:', JSON.stringify(paymentData, null, 2));

      // Отправляем запрос на создание платежа по сохраненной карте
      const response = await fetch('https://epay-api.homebank.kz/api/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Ошибка создания платежа:', response.status, errorText);
        return next(createError(response.status, `Ошибка создания платежа: ${errorText}`));
      }

      // Получаем HTML форму от Halyk Bank
      const htmlResponse = await response.text();
      console.log('Получен HTML ответ от Halyk Bank');

      // Обновляем заказ с информацией о платеже
      const currentExtra = order.extra ? JSON.parse(order.extra) : {};
      currentExtra.payment_info = {
        invoice_id: invoiceId,
        payment_method: 'saved_card',
        saved_card_id: saved_card_id,
        halyk_card_id: savedCard.halyk_card_id,
        card_mask: savedCard.card_mask,
        amount: totalCost,
        currency: 'KZT',
        payment_data: paymentData,
        created_at: new Date().toISOString()
      };

      await prisma.orders.update({
        where: { order_id: order.order_id },
        data: {
          order_uuid: invoiceId, // Сохраняем invoice ID для отслеживания
          extra: JSON.stringify(currentExtra)
        }
      });

      // Возвращаем HTML форму для оплаты
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(htmlResponse);

    } catch (error: any) {
      console.error('Ошибка оплаты сохраненной картой:', error);
      next(createError(500, `Ошибка обработки оплаты: ${error.message}`));
    }
  }

  /**
   * Получение статуса оплаты заказа
   */
  public static async getOrderPaymentStatusSavedCard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const userId = req.user?.user_id;

      if (!userId) {
        return next(createError(401, 'Пользователь не авторизован'));
      }

      if (!orderId) {
        return next(createError(400, 'Не указан ID заказа'));
      }

      // Получаем заказ с информацией о платеже
      const order = await prisma.orders.findFirst({
        where: {
          order_id: parseInt(orderId),
          user_id: userId
        }
      });

      if (!order) {
        return next(createError(404, 'Заказ не найден'));
      }

      // Получаем статус заказа
      const orderStatus = await prisma.order_status.findFirst({
        where: { order_id: order.order_id },
        orderBy: { log_timestamp: 'desc' }
      });

      const extra = order.extra ? JSON.parse(order.extra) : {};
      const paymentInfo = extra.payment_info || {};

      const response = {
        success: true,
        data: {
          order_id: order.order_id,
          order_uuid: order.order_uuid,
          status: orderStatus?.status || 0,
          is_paid: orderStatus?.status === 77, // PAID
          payment_info: {
            invoice_id: paymentInfo.invoice_id,
            payment_status: paymentInfo.payment_status,
            payment_method: paymentInfo.payment_method,
            amount: paymentInfo.amount,
            currency: paymentInfo.currency,
            error_message: paymentInfo.error_message
          }
        }
      };

      res.json(response);

    } catch (error: any) {
      console.error('Ошибка получения статуса оплаты:', error);
      next(createError(500, `Ошибка получения статуса: ${error.message}`));
    }
  }
}

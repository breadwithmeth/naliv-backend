import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// ===== МЕТОДЫ ОПЛАТЫ =====

// GET /api/payments/methods - Получить все методы оплаты
// Возвращает все методы оплаты из таблицы payment_types
router.get('/methods', PaymentController.getPaymentMethods);

// GET /api/payments/methods/active - Получить только активные методы оплаты (in_app = 1)
// Возвращает только методы оплаты, доступные в приложении
router.get('/methods/active', PaymentController.getActivePaymentMethods);

// GET /api/payments/methods/:id - Получить конкретный метод оплаты по ID
// Возвращает информацию о конкретном методе оплаты
router.get('/methods/:id', PaymentController.getPaymentMethodById);

// ===== СОХРАНЕНИЕ КАРТ HALYK BANK =====

/**
 * @route POST /api/payments/save-card/init
 * @desc Инициализация сохранения карты через Halyk Bank
 * @access Private (требует JWT токен)
 * @body { backLink: string, failureBackLink: string, postLink: string, description?: string, language?: string }
 * @returns { success: boolean, data: { paymentObject, jsLibraryUrl, invoiceId, instructions }, message: string }
 */
router.post('/save-card/init', authenticateToken, PaymentController.initCardSave);

/**
 * @route POST /api/payments/save-card/test-init
 * @desc Тестовый endpoint для инициализации без авторизации
 * @access Public
 * @body { userId?: number, amount?: number, invoiceId?: string }
 * @returns { success: boolean, data: { auth, invoiceId, amount, userId, timestamp }, message: string }
 */
router.post('/save-card/test-init', PaymentController.testCardSaveInit);

/**
 * @route POST /api/payments/test-invoice-generation
 * @desc Тестовый endpoint для генерации множественных Invoice ID
 * @access Public
 * @body { userId?: number, count?: number }
 * @returns { success: boolean, data: { generatedIds, totalGenerated, uniqueCount, allUnique }, message: string }
 */
router.post('/test-invoice-generation', PaymentController.testInvoiceGeneration);

/**
 * @route POST /api/payments/save-card/refresh-init
 * @desc Обновление токена и повторная инициализация сохранения карты
 * @access Private (требует JWT токен)
 * @body { backLink: string, failureBackLink: string, postLink: string, description?: string, language?: string }
 * @returns { success: boolean, data: { paymentObject, jsLibraryUrl, invoiceId, refreshed: true }, message: string }
 */
router.post('/save-card/refresh-init', authenticateToken, PaymentController.refreshCardSaveInit);

/**
 * @route POST /api/payments/status
 * @desc Получить статус платежа и обработать ошибки
 * @access Private (требует JWT токен)
 * @body { invoiceId: string, error?: string, errorMessage?: string }
 * @returns { success: boolean, data: { status, errorType?, userMessage, recommendation?, canRetry }, message: string }
 */
router.post('/status', authenticateToken, PaymentController.getPaymentStatus);

/**
 * @route POST /api/payments/save-card/postlink
 * @desc Обработка PostLink от Halyk Bank (webhook)
 * @access Public (вызывается Halyk Bank)
 * @body HalykPostLinkResponse
 * @returns { success: boolean, message: string }
 */
router.post('/save-card/postlink', PaymentController.handleCardSavePostLink);

/**
 * @route POST /api/payments/test-invoice-generation
 * @desc Тестовый эндпоинт для проверки генерации invoiceId
 * @access Public (только для тестирования)
 * @body { userId?: number }
 * @returns { success: boolean, data: { generatedIds, uniqueCount, allUnique } }
 */
router.post('/test-invoice-generation', async (req, res) => {
  try {
    const { userId = 1 } = req.body;
    
    console.log('\n--- Тест генерации invoiceId ---');
    
    // Генерируем 5 ID для проверки уникальности
    const ids = [];
    for (let i = 1; i <= 5; i++) {
      const invoiceId = await PaymentController.generateUniqueCardInvoiceId(userId, false);
      ids.push(invoiceId);
      console.log(`${i}. Сгенерирован: ${invoiceId}`);
      
      // Небольшая пауза между генерациями
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Тест с refresh флагом
    const refreshId = await PaymentController.generateUniqueCardInvoiceId(userId, true);
    console.log(`Refresh ID: ${refreshId}`);
    
    // Проверяем уникальность
    const allIds = [...ids, refreshId];
    const uniqueIds = [...new Set(allIds)];
    console.log(`Уникальных из ${allIds.length}: ${uniqueIds.length}`);
    
    res.json({
      success: true,
      data: {
        generatedIds: ids,
        refreshId: refreshId,
        totalGenerated: allIds.length,
        uniqueCount: uniqueIds.length,
        allUnique: allIds.length === uniqueIds.length,
        format: 'CARD{timestamp}{userID}{random}{refresh}'
      }
    });
    
  } catch (error) {
    console.error('Ошибка теста генерации:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка тестирования генерации invoiceId'
    });
  }
});

/**
 * @route POST /api/payments/save-card/test-init
 * @desc Тестовая инициализация без аутентификации
 * @access Public (только для тестирования)
 * @body { backLink, failureBackLink, postLink, description?, language? }
 * @returns { success: boolean, data: { paymentObject, jsLibraryUrl, invoiceId } }
 */
router.post('/save-card/test-init', async (req, res) => {
  try {
    const testUserId = req.body.userId || 252; // Из запроса или дефолтный
    
    console.log('\n--- Тестовая инициализация сохранения карты ---');
    console.log(`Пользователь: ${testUserId}`);
    
    // Генерируем invoiceId
    const invoiceId = await PaymentController.generateUniqueCardInvoiceId(testUserId, false);
    console.log(`Сгенерирован invoiceId для теста: ${invoiceId}`);

    // Подготавливаем данные для Halyk Bank
    const {
      backLink = 'https://test.com/success',
      failureBackLink = 'https://test.com/failure',
      postLink = 'http://localhost:3000/api/payments/save-card/postlink',
      description = 'Тест сохранения карты - автообновление',
      language = 'rus'
    } = req.body;

    // Формируем объект для Halyk Bank
    const halykData = {
      invoiceId,
      backLink,
      failureBackLink,
      postLink,
      language,
      description,
      accountId: testUserId.toString(),
      terminal: 'bb4dec49-6e30-41d0-b16b-8ba1831a854b',
      amount: 0,
      currency: 'KZT',
      cardSave: true,
      paymentType: 'cardVerification'
    };

    console.log('Запрос токена Halyk Bank для теста:', {
      orderUuid: invoiceId,
      amount: '0',
      userId: testUserId,
      timestamp: new Date().toISOString()
    });

    // Получаем токен от Halyk Bank (используем обновленные credentials)
    const tokenResponse = await fetch('https://epay-oauth.homebank.kz/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'grant_type': 'client_credentials',
        'scope': 'webapi usermanagement email_send verification statement statistics payment',
        'client_id': 'NALIV.KZ',
        'client_secret': 'B5Y56*Hw9hxcvwwY',
        'invoiceID': invoiceId,
        'amount': '0',
        'currency': 'KZT',
        'terminal': 'bb4dec49-6e30-41d0-b16b-8ba1831a854b'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error(`Halyk Bank token error: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json() as any;
    console.log('Токен Halyk Bank получен для теста:', {
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      token_type: tokenData.token_type,
      auth_preview: tokenData.access_token?.substring(0, 8) + '...',
      timestamp: new Date().toISOString()
    });

    // Добавляем токен к объекту
    const paymentObject = {
      ...halykData,
      auth: tokenData.access_token
    };

    res.json({
      success: true,
      data: {
        paymentObject,
        jsLibraryUrl: 'https://epay.homebank.kz/payform/payment-api.js',
        invoiceId,
        auth: tokenData.access_token,
        userId: testUserId,
        timestamp: new Date().toISOString(),
        expiresIn: tokenData.expires_in || 1200,
        instructions: {
          frontend: 'Подключите JS-библиотеку и вызовите halyk.cardverification(paymentObject)',
          method: 'halyk.cardverification()',
          testing: 'Каждый запрос генерирует уникальный invoiceId'
        }
      },
      message: `Свежие данные для пользователя ${testUserId} готовы`
    });

  } catch (error: any) {
    console.error('Ошибка тестовой инициализации:', error);
    res.status(500).json({
      success: false,
      message: `Ошибка тестовой инициализации: ${error.message}`
    });
  }
});

// ===== СОЗДАНИЕ ЗАКАЗА С ОПЛАТОЙ =====

/**
 * @route POST /api/payments/create-order-with-payment
 * @desc Создание заказа с последующей оплатой
 * @access Private (требует JWT токен)
 * @body { business_id: number, address_id?: number, items: array, bonus?: number, extra?: any, delivery_type: string, delivery_date?: string, payment_method?: string, saved_card_id?: number, backLink?: string, failureBackLink?: string, postLink?: string }
 * @returns HTML страница с инициализацией платежа
 */
router.post('/create-order-with-payment', authenticateToken, PaymentController.createOrderWithPayment);

/**
 * @route POST /api/payments/pay-with-saved-card
 * @desc Оплата существующего заказа сохраненной картой
 * @access Private (требует JWT токен)
 * @body { order_id: number, saved_card_id: number }
 * @returns HTML страница с инициализацией платежа сохраненной картой
 */
router.post('/pay-with-saved-card', authenticateToken, PaymentController.payOrderWithSavedCard);

/**
 * @route GET /api/payments/order-payment-status/:orderId
 * @desc Получение статуса заказа и связанного платежа для сохраненных карт
 * @access Private (требует JWT токен)
 * @param orderId - ID заказа
 * @returns { success: boolean, data: { order_id, order_uuid, status, is_paid, payment_info }, message: string }
 */
router.get('/order-payment-status/:orderId', authenticateToken, PaymentController.getOrderPaymentStatusSavedCard);

// ===== ОБРАБОТКА РЕЗУЛЬТАТОВ ОПЛАТЫ =====

/**
 * @route GET /api/payments/success
 * @desc Обработка успешной оплаты (backLink)
 * @access Public
 * @query { invoiceId?: string, orderId?: string, amount?: string, cardMask?: string }
 * @returns HTML страница с информацией об успешной оплате
 */
router.get('/success', PaymentController.handlePaymentSuccess);

/**
 * @route GET /api/payments/failure
 * @desc Обработка неудачной оплаты (failureBackLink)
 * @access Public
 * @query { invoiceId?: string, orderId?: string, error?: string, errorMessage?: string }
 * @returns HTML страница с информацией о неудачной оплате
 */
router.get('/failure', PaymentController.handlePaymentFailure);

/**
 * @route POST /api/payments/webhook
 * @desc Webhook для обработки уведомлений от Halyk Bank (postLink)
 * @access Public (вызывается Halyk Bank)
 * @body Данные от Halyk Bank о статусе платежа
 * @returns { status: string, message: string }
 */
router.post('/webhook', PaymentController.handlePaymentWebhook);

export default router;

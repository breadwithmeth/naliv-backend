import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/auth';
import { paymentsLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { paymentSchemas } from '../validation/schemas';

const router = Router();

// ===== МЕТОДЫ ОПЛАТЫ =====

// GET /api/payments/methods - Получить все методы оплаты
// Возвращает все методы оплаты из таблицы payment_types
//router.get('/methods', PaymentController.getPaymentMethods);

// GET /api/payments/methods/active - Получить только активные методы оплаты (in_app = 1)
// Возвращает только методы оплаты, доступные в приложении
//router.get('/methods/active', PaymentController.getActivePaymentMethods);

// GET /api/payments/methods/:id - Получить конкретный метод оплаты по ID
// Возвращает информацию о конкретном методе оплаты
//router.get('/methods/:id', PaymentController.getPaymentMethodById);

// ===== СОХРАНЕНИЕ КАРТ HALYK BANK =====

/**
 * @route POST /api/payments/generate-add-card-link
 * @desc Генерация ссылки для добавления карты
 * @access Private (требует JWT токен)
 * @returns { success: boolean, data: { addCardLink, token, expiresIn, userId, instructions }, message: string }
 */
router.post('/generate-add-card-link', authenticateToken, paymentsLimiter, PaymentController.generateAddCardLink);

/**
 * @route GET /api/payments/add-card
 * @desc Добавление новой карты через ссылку
 * @access Public (требует token в query параметре)
 * @query { token: string (JWT токен пользователя) }
 * @returns HTML страница для добавления карты
 */
router.get('/add-card', PaymentController.addCardByLink);

/**
 * @route GET /api/payments/add-card/success
 * @desc Страница успешного добавления карты
 * @access Public
 * @query { invoiceId?: string }
 * @returns HTML страница успеха
 */
router.get('/add-card/success', PaymentController.addCardSuccess);

/**
 * @route GET /api/payments/add-card/failure
 * @desc Страница ошибки добавления карты
 * @access Public
 * @query { error?: string, message?: string, invoiceId?: string }
 * @returns HTML страница ошибки
 */
router.get('/add-card/failure', PaymentController.addCardFailure);

/**
 * @route POST /api/payments/save-card/init
 * @desc Инициализация сохранения карты через Halyk Bank
 * @access Private (требует JWT токен)
 * @body { backLink: string, failureBackLink: string, postLink: string, description?: string, language?: string }
 * @returns { success: boolean, data: { paymentObject, jsLibraryUrl, invoiceId, instructions }, message: string }
 */
router.post('/save-card/init', authenticateToken, paymentsLimiter, validateRequest(paymentSchemas.addCardInit), PaymentController.initCardSave);

/**
 * @route POST /api/payments/save-card/refresh-init
 * @desc Обновление токена и повторная инициализация сохранения карты
 * @access Private (требует JWT токен)
 * @body { backLink: string, failureBackLink: string, postLink: string, description?: string, language?: string }
 * @returns { success: boolean, data: { paymentObject, jsLibraryUrl, invoiceId, refreshed: true }, message: string }
 */
router.post('/save-card/refresh-init', authenticateToken, paymentsLimiter, validateRequest(paymentSchemas.addCardInit), PaymentController.refreshCardSaveInit);

/**
 * @route POST /api/payments/status
 * @desc Получить статус платежа и обработать ошибки
 * @access Private (требует JWT токен)
 * @body { invoiceId: string, error?: string, errorMessage?: string }
 * @returns { success: boolean, data: { status, errorType?, userMessage, recommendation?, canRetry }, message: string }
 */
router.post('/status', authenticateToken, paymentsLimiter, validateRequest(paymentSchemas.status), PaymentController.getPaymentStatus);

/**
 * @route POST /api/payments/save-card/postlink
 * @desc Обработка PostLink от Halyk Bank (webhook)
 * @access Public (вызывается Halyk Bank)
 * @body HalykPostLinkResponse
 * @returns { success: boolean, message: string }
 */
router.post('/save-card/postlink', paymentsLimiter, PaymentController.handleCardSavePostLink);

/**
 * @route POST /api/payments/test-invoice-generation
 * @desc Тестовый эндпоинт для проверки генерации invoiceId
 * @access Public (только для тестирования)
 * @body { userId?: number }
 * @returns { success: boolean, data: { generatedIds, uniqueCount, allUnique } }
 */

// Небольшая пауза между генерациями
/**
 * @route POST /api/payments/pay-with-halyk-card
 * @desc Оплата существующего заказа по коду карты Halyk
 * @access Private (требует JWT токен)
 * @body { order_id: number, halyk_card_id: string }
 * @returns HTML страница с инициализацией платежа по коду карты Halyk
 */
router.post('/pay-with-halyk-card', authenticateToken, PaymentController.payWithSavedCard);

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

// ===== ПОЛУЧЕНИЕ СОХРАНЕННЫХ КАРТ ИЗ HALYK BANK API =====

/**
 * @route GET /api/payments/saved-cards/:accountId
 * @desc Получить список сохраненных карт из Halyk Bank API
 * @access Private (требует JWT токен)
 * @param { string } accountId - ID аккаунта (обычно user_id)
 * @returns { success: boolean, data: { cards: Card[], total: number, source: string, account_id: string }, message: string }
 */
router.get('/saved-cards/:accountId', authenticateToken, PaymentController.getSavedCardsFromHalyk);

/**
 * @route GET /api/payments/saved-cards-combined
 * @desc Получить объединенный список сохраненных карт (локальная БД + Halyk Bank API)
 * @access Private (требует JWT токен)
 * @returns { success: boolean, data: { cards: Card[], total: number, sources: object }, message: string }
 */
router.get('/saved-cards-combined', authenticateToken, PaymentController.getCombinedSavedCards);

export default router;
